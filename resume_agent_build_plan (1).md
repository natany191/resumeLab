# Resume‑Building AI Agent — Step‑by‑Step Build Plan (No Code)

This guide gives you a complete, **no‑code** build plan: exactly **what to install**, **what to configure**, and **what to do** at each step to build a Resume‑Building AI Agent. It includes shell commands and dependency lists, but no implementation code.

> **Note for Windows/PowerShell (`npx` blocked):** if you see “running scripts is disabled”, run the following **in the same PowerShell window** before using `npx`:
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> ```

---

## 0) Prerequisites (one‑time)

**Install:**
- Node.js **18+ (LTS)**
- Git
- VS Code
- Modern browser (Chromium/Firefox/Safari)
- Google account (for Gemini API key)

**Verify:**
```bash
node -v
npm -v
git --version
```

**Open project in VS Code later:** from the project folder run `code .`

---

## 1) Create the project (React + TypeScript)

**Goal:** scaffold a clean React + TS app.

**Create app (choose one package manager; example uses npm):**
```bash
npm create vite@latest resume-agent -- --template react-ts
cd resume-agent
```

**Core deps (included by Vite template):** `react`, `react-dom`, `typescript`, `vite`

**Dev UX / linting & formatting:**
```bash
npm i -D eslint @types/node @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier
```

**What to do:**
1. Initialize Git and make an initial commit.
2. Configure ESLint + Prettier (accept defaults or use VS Code extensions).
3. Create folders: `src/app`, `src/components`, `src/features/chat`, `src/features/resume`, `src/lib`, `src/styles`.

---

## 2) Styling & UI System

**Goal:** professional, responsive UI with minimal effort.

**Install (Tailwind stack):**
```bash
npm i -D tailwindcss postcss autoprefixer
node .\node_modules\tailwindcss\lib\cli.js init -p
```

**Optional fonts/icons:**
```bash
npm i lucide-react
npm i @fontsource-variable/inter @fontsource-variable/roboto-flex
```

**What to do:**
1. Wire Tailwind: set `content` paths and base layers, enable container sizes.
2. Define design tokens (spacing, radii) in Tailwind config.
3. Build the base layout: split pane (chat left, live resume preview right), stacks on mobile.

---

## 2.5) Landing Page & Initial Data Collection

**Goal:** Collect basic user info before AI chat begins.

**What to do:**
1. Create a welcome form component with:
   - Personal details (name, email, phone, location)
2. Add form validation with Zod
3. Pre-populate resume preview with collected data
4. Add "Start Building with AI" button that transitions to chat
5. Store initial data in Zustand store

---

## 3) State Management & Data Model

**Goal:** single source of truth for chat + resume data.

**Install (lightweight store):**
```bash
npm i zustand
```

**What to do:**
1. Define central store slices for: messages, conversation status, resume sections (contact, summary, experience, education, skills, extras), template selection, suggestion states.
2. Add actions/selectors for: adding messages, updating sections, switching templates, applying/rejecting suggestions.

---

## 4) Gemini AI Integration (no backend)

**Goal:** simple, secure connection to Google Gemini from the client.

**Install:**
```bash
npm i @google/generative-ai
```

**Environment:**
- Create a `.env` file (Vite style): `VITE_GEMINI_API_KEY=your_key_here`
- Ensure `.env` is listed in `.gitignore`.

**What to do:**
1. Create `src/lib/aiClient` with a small wrapper that:
   - Reads the API key from `import.meta.env`.
   - Sends the latest conversation context to Gemini.
   - Implements basic error handling and timeouts.
2. Decide on the response structure you expect (e.g., structured bullets + free text) and implement a parser layer that:
   - Extracts experience items, skills, and summary text.
   - Returns **“suggestions”** (pending) vs **“committed”** (applied) values separately.

---

## 5) Chat Interface

**Goal:** clean chat experience with typing/streaming feel.

**Optional helpers:**
```bash
npm i class-variance-authority date-fns
```

**What to do:**
1. Build message list (user/assistant/system), input box with Send, and a loading/typing indicator.
2. On Send: push user message to store → call AI client → push assistant message → update resume data store with extracted fields.
3. Add basic input validation and max length limits.

---

## 6) Resume Data Structure & Validation

**Goal:** reliable, merge‑safe data coming from chat.

**Install (schema validation):**
```bash
npm i zod
```

**What to do:**
1. Define Zod schemas for: Contact, Summary, Experience (role, company, dates, bullets), Education, Skills, Extras.
2. Validate/normalize AI‑extracted data before writing to the store (dates, arrays, max lengths).
3. Maintain a **“pending edits”** buffer to review suggestions before applying them.

---

## 7) Dynamic Resume Templates

**Goal:** multiple professional layouts with easy switching.

**What to do:**
1. Create 2–3 Tailwind‑based template components (e.g., **Classic**, **Modern**, **Compact**).
2. Standardize spacing, type scale, section headings, and bullet formatting.
3. Add a template switcher UI (tabs/radios) that uses the same store data.

---

## 8) Smart Content Suggestions

**Goal:** highlight improvements; user chooses what to accept.

**What to do:**
1. Extend the AI prompt wrapper to request rewrite suggestions for:
   - Achievement‑style bullets
   - Strong action verbs
   - Measurable outcomes
2. UI shows deltas (current vs suggested) with **Accept** and **Reject** controls.
3. Optionally track accepted suggestions for simple analytics (local only).

---

## 9) ATS Optimization (keywords & formatting)

**Goal:** guide the user to be ATS‑friendly.

**Install (lightweight fuzzy search):**
```bash
npm i fuse.js
```

**What to do:**
1. Add a panel to paste a target job description/title.
2. Extract keywords (simple tokenization or via AI) and score resume content for coverage.
3. Suggest missing keywords; flag risky formatting (tables/images/uncommon symbols).
4. Provide an **“ATS‑friendly variant”** toggle that reduces decorative elements.

---

## 10) PDF Export

**Goal:** print‑quality export from the live preview.

**Install (preferred, crisp text):**
```bash
npm i react-to-print
```

**What to do:**
1. Wrap the resume preview with a print handler.
2. Add print CSS (A4/Letter sizes, margins, page breaks, consistent fonts).
3. Provide an **Export as PDF** button that triggers printing to PDF.

> **Alternative (only if necessary):** `html-to-image` + `jspdf` for rasterized output (less crisp).

---

## 11) Export & Sharing Options

**Goal:** flexibility beyond PDF.

**Install:**
```bash
npm i file-saver
```

**What to do:**
1. Add **Export JSON** to save the resume data model.
2. Add **Import JSON** to restore a session.
3. Provide **Copy as plain text** for quick pasting into job portals.
4. (Optional) Add **Share link** via a gist/temporary paste service if acceptable (avoid secrets).

---

## 12) Error Handling & Resilience

**Goal:** graceful failures, clear user messages.

**What to do:**
1. Add a global error boundary to catch render errors with a friendly UI.
2. Centralize AI error handling: retries, fallbacks, and safe messaging when responses are empty or invalid.
3. Detect offline state and show a banner when the network drops.

---

## 13) Performance & Cost Optimizations

**Goal:** fast, frugal, responsive.

**Install (bundle analysis):**
```bash
npm i -D rollup-plugin-visualizer
```

**What to do:**
1. Code‑split heavy panels (PDF export, ATS analysis) with dynamic imports.
2. Debounce chat → preview updates.
3. Cache stable AI prompts/results per session to reduce API calls.
4. Minimize font weights and icon imports; tree‑shake icons.

---

## 14) Testing & Accessibility

**Goal:** confidence for demo & grading.

**Install:**
```bash
npm i -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom axe-core
```

**What to do:**
1. Add tests for: store updates, AI client wrapper (mocked), and PDF trigger.
2. Run basic a11y checks on key screens with `axe-core` in development.
3. Keyboard‑navigate: ensure focus states and landmarks are present.

---

## 15) Deployment

**Goal:** live demo with environment secrets handled.

**What to do:**
1. Pick Vercel or Netlify.
2. Set `VITE_GEMINI_API_KEY` in the host’s environment settings.
3. Build & deploy:
   ```bash
   npm run build
   ```
4. Smoke test: PDF export and chat flows on mobile + desktop.

---

## 16) Documentation & Presentation

**Goal:** clarity and polish.

**What to do:**
1. Write a README: architecture overview, feature list, constraints, and how to run.
2. Add a short “How it works” diagram (chat → parser → store → preview → export).
3. Record a 2–3 minute demo covering: conversation, template switch, ATS score, export.

---

## Quick Install Cheat‑Sheet (run in order)

```bash
# 1) Scaffold
npm create vite@latest resume-agent -- --template react-ts
cd resume-agent

# 2) Lint/format
npm i -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier

# 3) UI
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
# Optional UI extras
npm i lucide-react @fontsource-variable/inter @fontsource-variable/roboto-flex

# 4) State
npm i zustand

# 5) AI
npm i @google/generative-ai

# 6) Utils
npm i class-variance-authority date-fns zod fuse.js file-saver

# 7) PDF
npm i react-to-print

# 8) Testing
npm i -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom axe-core

# 9) Bundle analysis (optional)
npm i -D rollup-plugin-visualizer
```

---

## Suggested Milestones (for a 4‑week cadence)

- **Week 1:** Chat UI wired to Gemini; live preview updates.
- **Week 2:** Multiple resume templates; PDF export stable.
- **Week 3:** Suggestions + ATS panel; mobile polish.
- **Week 4:** Tests, docs, deployment, final presentation.
