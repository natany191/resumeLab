import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from '../store/useAppStore';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in environment variables');

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const FORCE_LANG: 'he' = 'he';

// ---------------- Types ----------------
interface RawAIResumeData {
  operation?: string;
  experience?: any;
  skills?: string[];
  removeSkills?: string[];
  removeExperiences?: string[];
  clearSections?: string[];
  summary?: string;
  completeResume?: any;
  contact?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    title?: string;
  };
}

interface NormalizedResumePatch {
  operation: 'patch' | 'replace' | 'reset';
  experience?: {
    id?: string;
    company?: string;
    title?: string;
    duration?: string;
    description?: string[];
  };
  skills?: string[];
  removeSkills?: string[];
  removeExperiences?: string[];
  clearSections?: string[];
  summary?: string;
  completeResume?: any;
  contact?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    title?: string;
  };
}

// ---------------- Parsing helpers ----------------
const safeJsonParse = (raw: string): any | null => {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^[\s`]+|[\s`]+$/g, '')
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(cleaned); } catch { return null; }
  }
};

const extractJsonBlock = (text: string): { data: any | null; error?: string } => {
  // 1. Full tagged block
  const pair = text.match(/\[RESUME_DATA\]([\s\S]*?)\[\/RESUME_DATA\]/i);
  if (pair) {
    const parsed = safeJsonParse(pair[1].trim());
    return { data: parsed, error: parsed ? undefined : 'Tagged JSON not parseable' };
  }

  // 2. Opening tag only -> attempt to find balanced braces after it
  const openIdx = text.search(/\[RESUME_DATA\]/i);
  if (openIdx !== -1) {
    const after = text.slice(openIdx + '[RESUME_DATA]'.length);
    const braceStart = after.indexOf('{');
    if (braceStart !== -1) {
      let depth = 0;
      for (let i = braceStart; i < after.length; i++) {
        if (after[i] === '{') depth++;
        else if (after[i] === '}') {
          depth--;
          if (depth === 0) {
            const candidate = after.slice(braceStart, i + 1);
            const parsed = safeJsonParse(candidate);
            if (parsed) return { data: parsed, error: 'Missing closing tag, recovered JSON' };
            break;
          }
        }
      }
    }
    return { data: null, error: 'Opening tag without JSON' };
  }

  // 3. Fenced block
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const parsed = safeJsonParse(fence[1].trim());
    return { data: parsed, error: parsed ? undefined : 'Fenced JSON not parseable' };
  }

  // 4. First top-level object fallback
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const parsed = safeJsonParse(braceMatch[0]);
    if (parsed) return { data: parsed, error: 'Used untagged JSON fallback' };
  }

  return { data: null, error: 'No JSON found' };
};

const normalizeResumeData = (raw: RawAIResumeData): NormalizedResumePatch => {
  const patch: NormalizedResumePatch = {
    operation: raw.operation === 'replace' || raw.operation === 'reset'
      ? raw.operation
      : 'patch'
  };

  // Experience normalization: accept "experience", "experiences" or nested forms
  let expSource: any = raw.experience ?? null;

  // If top-level object contains work/education keys, try to find them
  if (!expSource && raw && typeof raw === 'object') {
    const possibleContainers = ['experience', 'experiences', 'work', 'education', 'job', 'role', 'position'];
    for (const key of possibleContainers) {
      if ((raw as any)[key]) {
        expSource = (raw as any)[key];
        break;
      }
    }
  }

  if (Array.isArray(expSource)) expSource = expSource[0];

  if (expSource && typeof expSource === 'object') {
    // If the object itself wraps an array under common nested keys, unwrap
    const nestedKey = ['education', 'work', 'job', 'role', 'position', 'experiences', 'experience']
      .find(k => expSource[k]);
    if (nestedKey) {
      expSource = expSource[nestedKey];
      if (Array.isArray(expSource)) expSource = expSource[0];
    }

    if (expSource && typeof expSource === 'object') {
      // Normalize description to array (accept string or array)
      let desc: string[] = [];
      if (Array.isArray(expSource.description)) desc = expSource.description;
      else if (typeof expSource.description === 'string') {
        // split lines / bullets / semicolons / commas, keep non-empty
        desc = expSource.description
          .split(/[\r\n•;,-]{1,}/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      patch.experience = {
        id: expSource.id,
        company: (expSource.company || expSource.companyName || expSource.employer || '').trim(),
        title: (expSource.title || expSource.position || '').trim(),
        duration: expSource.duration || expSource.period || undefined,
        description: Array.isArray(desc) ? desc : []
      };
    }
  }

  if (Array.isArray(raw.skills)) patch.skills = raw.skills;
  if (Array.isArray(raw.removeSkills)) patch.removeSkills = raw.removeSkills;
  if (Array.isArray(raw.removeExperiences)) patch.removeExperiences = raw.removeExperiences;
  if (Array.isArray(raw.clearSections)) patch.clearSections = raw.clearSections;
  if (typeof raw.summary === 'string') patch.summary = raw.summary;
  if (raw.operation === 'replace' && raw.completeResume) {
    patch.completeResume = raw.completeResume;
  }
  if (raw.contact && typeof raw.contact === 'object') {
    patch.contact = {
      fullName: raw.contact.fullName?.trim(),
      email: raw.contact.email?.trim(),
      phone: raw.contact.phone?.trim(),
      location: raw.contact.location?.trim(),
      title: raw.contact.title?.trim()
    };
  }
  // Also allow contact nested inside completeResume
  if (!patch.contact && raw.completeResume?.contact) {
    patch.contact = raw.completeResume.contact;
  }

  return patch;
};

// ---------------- Apply patch to Zustand store ----------------
export const applyResumePatch = (patch: NormalizedResumePatch) => {
  const {
    addOrUpdateExperience,
    addSkills,
    removeSkills,
    replaceEntireResume,
    resetResume,
    removeExperience,
    clearAllExperiences,
    clearAllSkills,
    setSummary,
    clearSummary,
    setContactInfo
  } = useAppStore.getState();

  console.log('Applying resume patch:', patch);

  // Operation-level
  if (patch.operation === 'reset') {
    resetResume();
    return;
  }

  if (patch.operation === 'replace' && patch.completeResume) {
    replaceEntireResume({
      experiences: patch.completeResume.experiences || [],
      skills: patch.completeResume.skills || [],
      summary: patch.completeResume.summary || '',
      fullName: patch.completeResume.contact?.fullName || patch.completeResume.fullName || '',
      email: patch.completeResume.contact?.email || '',
      phone: patch.completeResume.contact?.phone || '',
      location: patch.completeResume.contact?.location || '',
      title: patch.completeResume.contact?.title || ''
    });
    return;
  }

  // Clears
  if (patch.clearSections?.includes('experiences')) clearAllExperiences();
  if (patch.clearSections?.includes('skills')) clearAllSkills();
  if (patch.clearSections?.includes('summary')) clearSummary();

  // Experience add/update
  if (patch.experience?.company) {
    addOrUpdateExperience({
      id: patch.experience.id,
      company: patch.experience.company,
      title: patch.experience.title || '',
      duration: patch.experience.duration || '',
      description: patch.experience.description || []
    });
  }

  // Remove experiences
  patch.removeExperiences?.forEach(key => removeExperience(key));

  // Skills
  if (patch.skills && patch.skills.length) addSkills(patch.skills);
  if (patch.removeSkills && patch.removeSkills.length) removeSkills(patch.removeSkills);

  // Summary
  if (typeof patch.summary === 'string' && patch.summary.trim()) {
    setSummary(patch.summary.trim());
  }
  if (patch.contact) {
    setContactInfo(patch.contact);
  }
};

// ---------------- Prompt builder ----------------
type Experience = { company: string; title?: string; duration?: string; description?: string[] };
type Resume = { experiences?: Experience[]; skills?: string[]; summary?: string };

const getSystemPrompt = (
  // language is now always 'he'
  language: string,
  userContext: any,
  resume: Resume,
  chatMessages?: any[]
) => {
  const currentExperiences: Experience[] = resume?.experiences || [];
  const currentSkills: string[] = resume?.skills || [];
  const currentSummary: string = resume?.summary || '';
  const targetJobPosting: string = userContext?.targetJobPosting || '';

  let conversationMemory = '';

  if (chatMessages?.length) {
    const aiQ = chatMessages.filter(m => m.type === 'ai').slice(-12).map(m => m.content);
    const userA = chatMessages.filter(m => m.type === 'user').slice(-12).map(m => m.content);
    conversationMemory = language === 'he'
      ? `זיכרון שיחה:
שאלות AI: ${aiQ.join(' | ')}
תשובות משתמש: ${userA.join(' | ')}`
      : `CONVERSATION MEMORY:
AI questions: ${aiQ.join(' | ')}
User answers: ${userA.join(' | ')}`;
  }

  const baseEnglish = `You are a decisive resume-building assistant. ALWAYS output a [RESUME_DATA] block (even if only one field changes).
Current resume:
Experiences(${currentExperiences.length}): ${currentExperiences.map(e => e.company + (e.title ? `(${e.title})` : '')).join(', ')}
Skills: ${currentSkills.join(', ')}
Summary: ${currentSummary || '(empty)'}
User: ${userContext?.fullName || 'User'} (${userContext?.currentRole || 'role unknown'})`;

  const plainTextCV = buildPlainTextResume(resume);
  const baseHebrew = `אתה מדריך לשיפור קורות חיים (Career Resume Improvement Guide).
מטרתך: לשפר בהדרגה את קורות החיים הקיימים כדי שיותאמו בצורה הטובה ביותר למשרה / דרישות היעד.

הנכנס:
{CURRENT_CV_TEXT}:
------------------
${plainTextCV || '(קורות חיים ריקים)'}

{TARGET_JOB}:
------------------
${targetJobPosting || '(לא סופק טקסט משרה)'}

הנחיות התאמה:
- שפר ניסוח, הוסף תוצאות מדידות, מיקוד תועלת ודיוק מינוח.
- שמור שמות טכנולוגיות / ספריות / חברות כפי שהן (באנגלית אם כך מופיעות).
- אל תמציא חברות או טכנולוגיות שלא הופיעו או שלא נאמרו במפורש ע"י המשתמש אלא אם ביקש להוסיף.
- אל תחליף תאריכים קיימים בלי הצדקה.
- בצע שינויים מדורגים: כל תשובה משנה רק מה שבאמת נדרש כעת לפי טקסט המשרה.
- אם אין לך שיפור ממשי לשדה מסוים – אל תחזיר אותו (חסוך רעש).
- תמיד החזר בלוק [RESUME_DATA] עם operation ("patch" אלא אם אתה מחזיר גרסה מלאה משופרת לגמרי ואז "replace").
- שאל שאלה הבהרה אחת בלבד כשחסר מידע קריטי (או אל תשאל אם מספיק ברור).`;

  const jobContext = targetJobPosting
    ? `התאם את הכל למשרה:\n${targetJobPosting}`
    : '';

  const rulesEn = `
RESPONSE RULES:
- <= 6 lines narrative before the data block.
- Ask ONE clarifying question if needed.
- ALWAYS include [RESUME_DATA] with operation ("patch" unless full replacement or reset).
- Provide only changed fields.
- DO NOT mention the exact target role title or company names from the job posting inside the summary or bullet descriptions. Keep content role-agnostic. Company names only appear in the structured "company" field.

FORMAT EXAMPLE:
[RESUME_DATA]
{
  "operation": "patch",
  "experience": {
    "company": "Harvard University",
    "title": "BSc in Computer Science",
    "duration": "2021-2025",
    "description": ["Built CNN project achieving 99% MNIST accuracy"]
  },
  "skills": ["Deep Learning","CNN"],
  "summary": "Computer science graduate focused on ML."
}
[/RESUME_DATA]`;

  const rulesHe = `
 כללי תגובה:
 - עד 6 שורות טקסט לפני בלוק הנתונים.
 - שאלה אחת בלבד.
 - תמיד [RESUME_DATA] עם operation ("patch" אלא אם החלפה מלאה או reset).
 - החזר רק שדות שעודכנו.
 - skills: עבור כישורי רכות / ניהול כתוב בעברית; שמות טכנולוגיות, מסגרות, שפות ומוצרים באנגלית.
 - כל התיאורים והתקציר בעברית, טכנולוגיות באנגלית.
 - שפר ניסוח: שקילות לערך עסקי / תוצאה מדידה (אחוזי שיפור, חיסכון זמן, הפחתת תקלות) רק אם ניתן להסיק בבטחה או המשתמש סיפק.
 - אין להמציא מספרים מדויקים אם לא נמסרו; אפשר לנסח "שיפור משמעותי" במקום.
 - אם אין שינוי נחוץ – החזר בלוק עם שאלה / עדכון מינורי בלבד.
 
 דוגמה:
 [RESUME_DATA]
 {
   "operation": "patch",
   "experience": {
     "company": "Company",
     "title": "Security Operations Lead",
     "duration": "2022-2024",
     "description": ["ניהול צוות משמרת 8 אנליסטים", "יישום נהלי תגובה שאיצבו זמני טיפול"]
   },
   "skills": ["ניהול צוות","Incident Response","SIEM","Leadership"]
 }
 [/RESUME_DATA]`;

  // Force Hebrew prompt + add translation requirement
  const translationRule = `
הוראות שפה:
- כל הטקסט החופשי (תיאור תפקידים, תקציר, שאלות הבהרה) בעברית תקנית.
- אין לתרגם שמות חברות, טכנולוגיות, שמות כלי פיתוח או שמות תארים רשמיים (React, AWS, Node.js, Harvard).
- כישורים (skills) להישאר בפורמט מקובל (בדרך כלל באנגלית) אלא אם המשתמש כתב אותם במפורש בעברית.
- אם המשתמש כותב באנגלית – תתרגם לעברית בתוצר, חוץ משמות proper nouns כפי שמוגדר לעיל.
`;

  return `${baseHebrew}
 ${conversationMemory}
 ${jobContext}
 ${translationRule}
${rulesHe}`;
};

// ---------------- Public API ----------------
export const sendMessageToAI = async (
  message: string,
  userContext?: any,
  resumeData?: Resume,
  chatMessages?: any[]
) => {
  try {
    const lang = FORCE_LANG;
    const systemPrompt = getSystemPrompt(lang, userContext, resumeData || {}, chatMessages);

    const fullPrompt = `${systemPrompt}
    
הודעת משתמש (יתכן באנגלית או בעברית – התוצר בעברית): "${message}"

זכור: תמיד לכלול בלוק [RESUME_DATA] גם אם עדכון יחיד.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw AI text:', text);

    let conversationMessage = text.trim();
    let resumeUpdates: NormalizedResumePatch | undefined;

    const { data: parsedData, error: parseError } = extractJsonBlock(text);
    if (parseError) console.warn('Resume parse note:', parseError);

    if (parsedData) {
      console.log('Raw parsed JSON:', parsedData);
      resumeUpdates = normalizeResumeData(parsedData);
      conversationMessage = conversationMessage
        .replace(/\[RESUME_DATA\][\s\S]*?\[\/RESUME_DATA\]/i, '')
        .replace(/```(?:json)?[\s\S]*?```/i, '')
        .trim();
      applyResumePatch(resumeUpdates);
    } else {
      console.warn('No parsable resume block found.', parseError);
    }

    return { message: conversationMessage, resumeUpdates: resumeUpdates || {} };
  } catch (error) {
    console.error('AI error:', error);
    return {
      message: error instanceof Error ? `API Error: ${error.message}` : 'Unknown API error.',
      resumeUpdates: {}
    };
  }
};

export const extractResumeFromPlainText = async (rawText: string) => {
  try {
    // Local quick contact extraction before AI (best-effort)
    const quickExtract = (text: string) => {
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      const phone =
        text.match(/(?:\+972[-\s]?|0)(?:5\d[-\s]?\d{3}[-\s]?\d{4})/)?.[0] ||
        text.match(/(?:\+?\d{1,3}[-\s]?)?(?:\d{2,4}[-\s]?){2,4}\d{2,4}/)?.[0];
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const firstLines = lines.slice(0, 8).filter(l => l.length < 50);
      const namePattern = /^[\u0590-\u05FFA-Za-z]+([ '\-][\u0590-\u05FFA-Za-z]{2,}){0,3}$/;
      let fullName = firstLines.find(l => namePattern.test(l) && !/@/.test(l) && l.split(' ').length <= 4);
      // If still not found, try first line that has 2 words and no digits
      if (!fullName) {
        fullName = firstLines.find(l => /^\D+$/.test(l) && l.split(/\s+/).length === 2);
      }
      return { email, phone, fullName };
    };
    const heur = quickExtract(rawText);
    if (heur.fullName || heur.email || heur.phone) {
      useAppStore.getState().setContactInfo({
        fullName: heur.fullName,
        email: heur.email,
        phone: heur.phone,
      });
    }

    const prompt = `אתה ממיר טקסט קורות חיים (PDF -> טקסט) לפלט אחד בעברית.
החזר אך ורק בלוק [RESUME_DATA] יחיד עם:
operation = "replace"
completeResume.contact: { fullName, title, email, phone, location }
completeResume.experiences: עד 6 חוויות. description: עד 4 נקודות קצרות (עברית; טכנולוגיות באנגלית).
completeResume.skills: מערך ייחודי (React, Node.js, AWS...).
completeResume.summary: 2–3 משפטים בעברית, ללא מידע רגיש אישי נוסף.
contact.fullName חובה; אם לא מזוהה במפורש – הסק מהשורה העליונה בעלת 2–4 מילים ללא מספרים.
אל תוסיף טקסט מחוץ לבלוק. שמור שמות חברות וטכנולוגיות בשפתן המקורית.

[SOURCE_RESUME_TEXT]
${rawText.slice(0, 25000)}
[/SOURCE_RESUME_TEXT]`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const { data: parsed } = extractJsonBlock(text);
    if (parsed) {
      const patch = normalizeResumeData(parsed);
      applyResumePatch(patch);
      // Optional: if contact name still missing, trigger a minimal follow‑up request
      if (!patch.contact?.fullName) {
        const state = useAppStore.getState();
        if (!state.resume.fullName) {
          // Fire and forget (no await) to avoid blocking UX
          sendMessageToAI('אנא ספק רק contact עם fullName ו title אם חסר, בלי לשנות חלקים אחרים.', 
            { targetJobPosting: state.targetJobPosting },
            state.resume,
            state.chatMessages
          );
        }
      }
      return { ok: true, raw: text, patch };
    }
    return { ok: false, error: 'NO_JSON', raw: text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'UNKNOWN',
    };
  }
};

const buildPlainTextResume = (resume: any): string => {
  const lines: string[] = [];
  if (resume.fullName || resume.title) {
    lines.push(`${resume.fullName || ''} ${resume.title ? '— ' + resume.title : ''}`.trim());
  }
  if (resume.summary) {
    lines.push('--- תקציר ---');
    lines.push(resume.summary);
  }
  if (resume.experiences?.length) {
    lines.push('--- ניסיון ---');
    resume.experiences.forEach((e: any, i: number) => {
      lines.push(`${i + 1}. ${e.company || ''}${e.title ? ' – ' + e.title : ''}${e.duration ? ' (' + e.duration + ')' : ''}`);
      (e.description || []).slice(0, 8).forEach((d: string) => lines.push('• ' + d));
    });
  }
  if (resume.skills?.length) {
    lines.push('--- כישורים ---');
    lines.push(resume.skills.join(', '));
  }
  return lines.join('\n');
};

