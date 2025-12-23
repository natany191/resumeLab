import { create } from 'zustand';
import { z } from 'zod';

// Simplified onboarding schema
const welcomeFormSchema = z.object({
  targetJobPosting: z.string().optional(),
});
type WelcomeFormData = z.infer<typeof welcomeFormSchema>;

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface Experience {
  id?: string;
  company: string;
  title: string;
  duration?: string;
  description: string[];
}

interface Resume {
  experiences: Experience[];
  skills: string[];
  summary: string;
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string; // headline / current role
}

interface ResumeDataPatch {
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

interface AppStore {
  currentScreen: 'welcome' | 'chat';
  userBasicInfo: WelcomeFormData | null;
  chatMessages: ChatMessage[];
  resume: Resume;
  targetJobPosting?: string;
  originalResumeText?: string;

  setUserBasicInfo: (data: WelcomeFormData) => void;
  goToChat: () => void;
  addChatMessage: (content: string, type: 'user' | 'ai') => void;
  setTargetJobPosting: (text: string) => void;
  setOriginalResumeText: (text: string) => void;

  updateResume: (updates: Partial<Resume>) => void;

  addOrUpdateExperience: (experience: Experience) => void;
  removeExperience: (idOrCompany: string) => void;
  clearAllExperiences: () => void;
  replaceAllExperiences: (experiences: Experience[]) => void;

  addSkills: (newSkills: string[]) => void;
  removeSkills: (skillsToRemove: string[]) => void;
  replaceSkills: (newSkills: string[]) => void;
  clearAllSkills: () => void;

  setSummary: (summary: string) => void;
  clearSummary: () => void;

  resetResume: () => void;
  replaceEntireResume: (newResume: Resume) => void;
  applyResumeDataPatch: (patch: ResumeDataPatch) => void;

  setContactInfo: (
    c: Partial<Pick<Resume, 'fullName' | 'email' | 'phone' | 'location' | 'title'>>
  ) => void;
}

const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  currentScreen: 'welcome',
  userBasicInfo: null,
  chatMessages: [],
  resume: {
    experiences: [],
    skills: [],
    summary: '',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    title: '',
  },
  targetJobPosting: undefined,
  originalResumeText: undefined,

  // Actions
  setUserBasicInfo: (data) => set({ userBasicInfo: data }),

  setTargetJobPosting: (text) =>
    set((state) => ({
      targetJobPosting: text,
      userBasicInfo: {
        ...(state.userBasicInfo || {}),
        targetJobPosting: text,
      } as WelcomeFormData,
    })),

  setOriginalResumeText: (text) => set({ originalResumeText: text }),

  goToChat: () => set({ currentScreen: 'chat' }),

  addChatMessage: (content, type) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        { id: makeId(), type, content, timestamp: new Date() },
      ],
    })),

  setContactInfo: (c) =>
    set((state) => ({
      resume: { ...state.resume, ...c },
      userBasicInfo: {
        ...(state.userBasicInfo || {}),
        ...(c.fullName ? { fullName: c.fullName } : {}),
        ...(c.title ? { currentRole: c.title } : {}),
        ...(c.email ? { email: c.email } : {}),
        ...(c.phone ? { phone: c.phone } : {}),
        ...(c.location ? { location: c.location } : {}),
      },
    })),

  updateResume: (updates) =>
    set((state) => ({ resume: { ...state.resume, ...updates } })),

  addOrUpdateExperience: (incoming) =>
    set((state) => {
      const exp: Experience = {
        ...incoming,
        id: incoming.id || makeId(),
        description: Array.from(new Set(incoming.description || [])),
      };

      const idx = state.resume.experiences.findIndex(
        (e) =>
          (exp.id && e.id && e.id === exp.id) ||
          (e.company &&
            exp.company &&
            e.company.trim().toLowerCase() === exp.company.trim().toLowerCase())
      );

      if (idx !== -1) {
        const prev = state.resume.experiences[idx];
        const merged: Experience = {
          ...prev,
          ...exp,
          id: prev.id || exp.id,
          description: Array.from(
            new Set([...(prev.description || []), ...(exp.description || [])])
          ),
        };
        const experiences = [...state.resume.experiences];
        experiences[idx] = merged;
        return { resume: { ...state.resume, experiences } };
      }

      return {
        resume: {
          ...state.resume,
            experiences: [...state.resume.experiences, exp],
        },
      };
    }),

  removeExperience: (idOrCompany) =>
    set((state) => ({
      resume: {
        ...state.resume,
        experiences: state.resume.experiences.filter(
          (e) =>
            !(
              (e.id && e.id === idOrCompany) ||
              e.company.trim().toLowerCase() ===
                idOrCompany.trim().toLowerCase()
            )
        ),
      },
    })),

  clearAllExperiences: () =>
    set((state) => ({
      resume: { ...state.resume, experiences: [] },
    })),

  replaceAllExperiences: (experiences) =>
    set((state) => ({
      resume: { ...state.resume, experiences },
    })),

  addSkills: (newSkills) =>
    set((state) => ({
      resume: {
        ...state.resume,
        skills: Array.from(
          new Set([
            ...state.resume.skills,
            ...newSkills.map((s) => s.trim()).filter(Boolean),
          ])
        ),
      },
    })),

  removeSkills: (skillsToRemove) =>
    set((state) => {
      const toRemove = skillsToRemove.map((s) => s.toLowerCase().trim());
      return {
        resume: {
          ...state.resume,
          skills: state.resume.skills.filter(
            (s) => !toRemove.includes(s.toLowerCase().trim())
          ),
        },
      };
    }),

  replaceSkills: (newSkills) =>
    set((state) => ({
      resume: {
        ...state.resume,
        skills: newSkills.map((s) => s.trim()).filter(Boolean),
      },
    })),

  clearAllSkills: () =>
    set((state) => ({
      resume: { ...state.resume, skills: [] },
    })),

  setSummary: (summary) =>
    set((state) => ({
      resume: { ...state.resume, summary },
    })),

  clearSummary: () =>
    set((state) => ({
      resume: { ...state.resume, summary: '' },
    })),

  resetResume: () =>
    set(() => ({
      resume: {
        experiences: [],
        skills: [],
        summary: '',
        fullName: '',
        email: '',
        phone: '',
        location: '',
        title: '',
      },
    })),

  replaceEntireResume: (newResume) =>
    set(() => ({
      resume: newResume,
    })),

  applyResumeDataPatch: (patch) => {
    if (!patch || typeof patch !== 'object') return;
    const op = patch.operation || 'patch';
    const current = get().resume;

    const normalizeExperiences = (
      list: ResumeDataPatch['experiences']
    ): Experience[] => {
      if (!Array.isArray(list)) return [];
      return list
        .filter((e) => e && (e.company || e.title))
        .map((e) => {
          const descArr = Array.isArray(e.description)
            ? e.description
            : typeof e.description === 'string'
            ? [e.description]
            : [];
          return {
            id: e.id,
            company: (e.company || 'Unknown').trim(),
            title: (e.title || '').trim(),
            duration: e.duration || undefined,
            description: Array.from(
              new Set(descArr.filter(Boolean).map((d) => d.trim()))
            ),
          };
        });
    };

    if (op === 'replace') {
      const newResume: Resume = {
        experiences:
          normalizeExperiences(patch.experiences) || current.experiences,
        skills: Array.isArray(patch.skills)
          ? Array.from(
              new Set(patch.skills.map((s) => s.trim()).filter(Boolean))
            )
          : current.skills,
        summary:
          typeof patch.summary === 'string'
            ? patch.summary.trim()
            : current.summary,
        fullName:
          patch.contact?.fullName?.trim() ?? current.fullName ?? undefined,
        email: patch.contact?.email?.trim() ?? current.email ?? undefined,
        phone: patch.contact?.phone?.trim() ?? current.phone ?? undefined,
        location:
          patch.contact?.location?.trim() ?? current.location ?? undefined,
        title: patch.contact?.title?.trim() ?? current.title ?? undefined,
      };
      set({ resume: newResume });
      return;
    }

    // Patch merge
    if (Array.isArray(patch.experiences)) {
      normalizeExperiences(patch.experiences).forEach((exp) => {
        get().addOrUpdateExperience(exp);
      });
    }
    if (Array.isArray(patch.skills)) {
      get().addSkills(patch.skills);
    }
    if (typeof patch.summary === 'string' && patch.summary.trim()) {
      get().setSummary(patch.summary.trim());
    }
    if (patch.contact) {
      get().setContactInfo(patch.contact);
    }
  },
}));