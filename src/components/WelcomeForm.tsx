import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { extractResumeFromPlainText } from '../services/geminiService';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs'; // ensure bundler can locate worker (Vite may need alias)

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const MAX_SIZE_MB = 8;

const WelcomeForm: React.FC = () => {
  const setOriginalResumeText = useAppStore(s => s.setOriginalResumeText);
  const setTargetJobPosting = useAppStore(s => s.setTargetJobPosting);
  const goToChat = useAppStore(s => s.goToChat);

  const [jobText, setJobText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSelectFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      setError('נא להעלות קובץ PDF בלבד');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`גודל קובץ גדול מ-${MAX_SIZE_MB}MB`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onSelectFile(e.target.files[0]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) onSelectFile(e.dataTransfer.files[0]);
  }, []);

  const prevent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const extractPdfText = async (f: File): Promise<string> => {
    const arrayBuf = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ');
      text += '\n' + pageText;
    }
    return text;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('נא לצרף קובץ PDF');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pdfText = await extractPdfText(file);
      setOriginalResumeText(pdfText);
      if (jobText.trim()) setTargetJobPosting(jobText.trim());

      // Kick AI extraction
      const result = await extractResumeFromPlainText(pdfText);
      if (!result.ok) {
        setError('כשל בעיבוד ה-AI: ' + (result.error || ''));
      } else {
        // After successful parsing navigate to chat
        goToChat();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא צפויה בקריאת PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-4 py-12 font-[Heebo]">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-semibold text-gray-900">נתחיל מהקורות חיים הנוכחיים שלך</h1>
          <p className="mt-3 text-gray-600">העלה PDF קיים והמערכת תחלץ ותשפר את הנתונים עבורך. הוסף גם טקסט משרה יעד כדי לחדד התאמה.</p>
        </header>

        <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white/80 p-6 md:p-8 shadow-lg shadow-indigo-100 space-y-8">
          
          {/* Upload */}
            <div
              onDrop={onDrop}
              onDragOver={prevent}
              onDragEnter={prevent}
              onDragLeave={prevent}
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition
              ${file ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'}
              `}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-indigo-100 p-4 text-indigo-600">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-700">
                  {file ? <span className="font-medium text-indigo-700">{file.name}</span> : 'גרור ושחרר את קובץ ה-PDF של הקורות חיים כאן'}
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  בחר קובץ
                </button>
                <p className="text-xs text-gray-400">PDF עד {MAX_SIZE_MB}MB</p>
              </div>
            </div>

          {/* Job posting */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">מודעת משרה / טקסט דרישות (אופציונלי)</label>
            <textarea
              dir="rtl"
              rows={6}
              className="w-full rounded-xl border border-gray-300 bg-white/60 px-4 py-3 text-sm leading-relaxed shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="הדבק כאן מודעת משרה או תיאור תפקיד יעד..."
              value={jobText}
              onChange={e => setJobText(e.target.value)}
            />
            <p className="text-[11px] text-gray-500">הטקסט ישמש להתאמה מוש intelligent של התקציר והנקודות.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <button
              type="submit"
              disabled={loading || !file}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-3 text-sm font-medium text-white shadow-md shadow-indigo-400/30 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'מעבד...' : 'המשך לצ׳אט'}
            </button>
            {!file && <span className="text-xs text-gray-500">נדרש קובץ PDF כדי להמשיך</span>}
          </div>
        </form>

        <footer className="mt-10 text-center text-xs text-gray-400">
          הנתונים מעובדים מקומית לפני שליחה ל-AI. ודא שאין מידע רגיש במיוחד.
        </footer>
      </div>
    </div>
  );
};

export default WelcomeForm;