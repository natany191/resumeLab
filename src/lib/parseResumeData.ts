// src/lib/parseResumeData.ts
export interface ResumeDataPatch {
  operation?: 'patch' | 'replace';
  experiences?: Array<{
    id?: string;
    company?: string;
    title?: string;
    duration?: string | null;
    description?: string[] | string | null;
  }>;
  skills?: string[];
  summary?: string;
  contact?: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    title?: string;
  };
}

interface ParseResult {
  patch?: ResumeDataPatch;
  cleanedText: string;
  rawJson?: string;
  error?: string;
}

function extractFirstBalancedObject(text: string): string | null {
  let start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseResumeData(raw: string): ParseResult {
  if (!raw) return { cleanedText: '', error: 'EMPTY_INPUT' };

  // Remove BOM / control chars
  let work = raw.replace(/^[\uFEFF]/, '');

  // Extract fenced code block first
  const fenceMatch = work.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1] : null;

  if (!candidate) {
    // Try bracketed tag extraction
    const tagIdx = work.indexOf('[RESUME_DATA]');
    if (tagIdx !== -1) {
      const after = work.slice(tagIdx + '[RESUME_DATA]'.length);
      candidate = extractFirstBalancedObject(after);
    }
  }
  if (!candidate) {
    candidate = extractFirstBalancedObject(work);
  }

  if (!candidate) {
    return { cleanedText: raw.trim(), error: 'NO_JSON_FOUND' };
  }

  let jsonText = candidate.trim();

  // Light normalization
  // replace smart quotes, remove trailing commas and trim
  const cleanedJson = jsonText
    .replace(/[“”\u2018\u2019]/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

  try {
    const parsed = JSON.parse(cleanedJson);

    const patch: ResumeDataPatch = {};
    if (parsed.operation && (parsed.operation === 'patch' || parsed.operation === 'replace')) {
      patch.operation = parsed.operation;
    }

    // experiences normalization: accept "experiences" or singular "experience"
    if (parsed.experiences) {
      patch.experiences = Array.isArray(parsed.experiences) ? parsed.experiences : [parsed.experiences];
    } else if (parsed.experience) {
      patch.experiences = Array.isArray(parsed.experience) ? parsed.experience : [parsed.experience];
    }

    if (Array.isArray(parsed.skills)) patch.skills = parsed.skills;
    if (typeof parsed.summary === 'string') patch.summary = parsed.summary;
    if (parsed.contact && typeof parsed.contact === 'object') {
      patch.contact = {
        fullName: parsed.contact.fullName,
        email: parsed.contact.email,
        phone: parsed.contact.phone,
        location: parsed.contact.location,
        title: parsed.contact.title
      };
    }

    return { patch, cleanedText: raw.trim(), rawJson: cleanedJson };
  } catch (e) {
    return { cleanedText: raw.trim(), rawJson: jsonText, error: 'JSON_PARSE_ERROR' };
  }
}