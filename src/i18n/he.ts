// src/i18n/he.ts
interface Placeholders {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  currentRole: string;
  experienceYears: string;
  industry: string;
  keySkills: string;
  targetJobPosting: string;
}

export const he = {
  formTitle: 'בוא נבנה קורות חיים מותאמים',
  formSubtitle: 'מלא פרטים בסיסיים – נעדכן ונשפר בהמשך',
  fullName: 'שם מלא',
  email: 'דוא"ל',
  phone: 'טלפון',
  location: 'מיקום',
  currentRole: 'תפקיד נוכחי',
  experienceYears: 'שנות ניסיון',
  industry: 'תעשייה',
  keySkills: 'כישורי מפתח',
  targetJobPosting: 'מודעת משרה יעד / תיאור תפקיד',
  start: 'המשך לצ\'אט',
  resumePreview: 'תצוגה מקדימה של קורות חיים',
  experiences: 'ניסיון תעסוקתי',
  skills: 'כישורים',
  summary: 'תקציר',
  noExperiences: 'אין עדיין ניסיון',
  noSkills: 'אין כישורים עדיין',
  noSummary: 'אין תקציר עדיין',
  placeholder: {
    fullName: 'הקלד שם מלא',
    email: 'name@example.com',
    phone: '05x-xxxxxxx (לא חובה)',
    location: 'עיר, מדינה (לא חובה)',
    currentRole: 'תפקיד נוכחי (למשל: מפתח Frontend)',
    experienceYears: 'לדוגמה: 5',
    industry: 'תחום (פינטק, סייבר, בריאות...)',
    keySkills: 'React, Node.js, SQL...',
    targetJobPosting: 'הדבק מודעת משרה או דרישות עיקריות'
  } as Placeholders
};

type AllKeys = keyof typeof he;
type ObjectKeys = 'placeholder';
type SimpleTextKeys = Exclude<AllKeys, ObjectKeys>;

export const t = (k: SimpleTextKeys): string => he[k] as string;