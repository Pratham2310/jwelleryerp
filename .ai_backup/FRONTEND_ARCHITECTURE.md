# FRONTEND_ARCHITECTURE.md

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19.0.1 | Function components + hooks only, no class components |
| Build tool | Vite 6.2.3 | `@vitejs/plugin-react`, dev server on port 3000, `--host=0.0.0.0` |
| Language | TypeScript ~5.8.2 | `tsconfig.json`: `strict`-adjacent (`noEmit`, `isolatedModules`, `moduleDetection: force`), `jsx: react-jsx`, path alias `@/*` → repo root |
| Styling | Tailwind CSS v4.1.14 | **CSS-first config** via `@tailwindcss/vite` plugin + `@theme` block in `src/index.css` — there is **no** `tailwind.config.js` |
| Routing | react-router-dom v7.18.1 | `HashRouter` (not `BrowserRouter`) — see `ROUTING.md` |
| Icons | lucide-react 0.546.0 | Used extensively, consistent icon language across screens |
| Class merging | `clsx` + `tailwind-merge` via `src/lib/utils.ts`'s `cn()` | Standard shadcn-style utility |
| Animation | `motion` (12.23.24) | **Installed but unused** — no `import ... from 'motion'` anywhere in `src/`. Dead dependency; either wire it in for the polish it implies or remove it. |
| AI SDK | `@google/genai` (2.4.0) | **Installed but unused.** Leftover from the Google AI Studio template. No Gemini calls anywhere in `src/`. |
| Server bits | `express`, `dotenv`, `tsx` | **Unused** — no `server.js`/backend file exists in the repo despite `package.json`'s `clean` script referencing `server.js`. Template leftovers for eventual Cloud Run deployment, not a hidden backend. |

Run locally: `npm install && npm run dev` (Vite dev server). `npm run build` → `vite build`. `npm run lint` → `tsc --noEmit` (type-check only, no ESLint/Prettier configured in this repo).

## 2. Entry Point & App Shell

```
main.tsx → <StrictMode><App /></StrictMode>
App.tsx  → <Router (HashRouter)><AppContent /></Router>
```

`AppContent` (inside `App.tsx`) is the single largest orchestration point in the app. It owns:
- Auth state (`user`) — read from/written to `localStorage['stitch_auth_user']`.
- Theme state (`theme: 'light'|'dark'`) — read from/written to `localStorage['stitch_theme']`, applied by toggling a `light`/`dark` class on `document.documentElement`.
- The six core domain state slices (`metalRates`, `items`, `customers`, `karigars`, `workOrders`, `invoices`) — **each individually mirrored to its own `localStorage` key via a dedicated `useEffect`.**
- The "Simulation Desk" (latency + forceOffline toggles) that fakes network behavior on every route change.
- Two shared modal-open booleans (`isAddModalOpen`, `isIssueModalOpen`) that are lifted to `App` specifically so the Dashboard's quick-action buttons can navigate to another screen *and* pop that screen's modal open in one click.

## 3. State Management Pattern — and Its Inconsistency

**There is no Redux/Zustand/Context-based global store.** The pattern is: lift state to the nearest common ancestor (`App.tsx`) and prop-drill it down into each route's component, with a `useEffect` syncing each slice to `localStorage` independently.

**This pattern is not applied consistently**, and any new agent must know this before adding a new domain entity:

- `metalRates`, `items`, `customers`, `karigars`, `workOrders`, `invoices` → lifted to `App.tsx`, passed as props, persisted via `App.tsx`'s `useEffect`s.
- `LooseStone[]` (Stones & Diamonds) → **owned entirely inside `StoneManager.tsx`** via its own `useState` + its own `useEffect` writing to `localStorage['stitch_loose_stones']`. `App.tsx` never sees this data and passes no stone props into any route except `karigars` (for the "assign to karigar" dropdown).
- `JobBag[]` (Job Bags Tracker) → **owned entirely inside `JobBagManager.tsx`**, same pattern, `localStorage['stitch_job_bags']`.

**Consequence:** Dashboard KPIs, cross-module search (see §5), and any future report cannot see stone or job-bag data without either lifting that state up or fetching it independently. **Do not add a ninth domain entity using the local-component-state pattern** — lift new state to `App.tsx` to match the majority pattern, or (better, if doing a larger refactor) introduce a proper Context/store and migrate all nine entities onto it uniformly in one pass.

## 4. Theming

Dark/light is a single `theme` value in `localStorage['stitch_theme']` (default `'dark'`), applied as a class on `<html>`. There is **no ThemeContext** — instead, **almost every component independently re-implements the same boilerplate**:
```ts
const [theme, setTheme] = useState<'light'|'dark'>(() => localStorage.getItem('stitch_theme') as any || 'dark');
useEffect(() => {
  const checkTheme = () => setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  checkTheme();
  const observer = new MutationObserver(checkTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}, []);
```
This exact block (or a close variant) appears independently in `App.tsx`, `Sidebar.tsx`, `BillingEstimator.tsx`, `JobBagManager.tsx`, `StoneManager.tsx`, and others. **This should be extracted into a `useTheme()` hook or a `ThemeContext.Provider`** — see `TODO.md` and `CODING_RULES.md`. Do not add a tenth copy of this block; use/introduce the shared hook instead.

Most of the actual dark-theme visual language is **not** applied via Tailwind dark-mode variants or the `ui/` component library — it's applied via a large block of global `!important` CSS overrides in `src/index.css` that intercept plain Tailwind utility classes like `bg-white`, `bg-slate-50`, `text-slate-700`, `bg-amber-500`, etc. and force them to the gold/black palette. See `COMPONENT_LIBRARY.md` for the full implication of this.

## 5. Cross-Cutting Concerns

- **Global search** (`Header.tsx`) imports `initialJewelleryItems`, `initialCustomers`, `initialKarigars` **directly from `src/data/mockData.ts`**, not from `App.tsx`'s live state (which isn't even passed into `Header` as a prop). This means the header search box only ever searches the original seed data — items/customers added or edited during a session are invisible to it. This needs to be rewired to receive live state as props (or via a shared store) before it's a real feature.
- **Notifications** (`Header.tsx`) are a hardcoded static array (`useState` initial value), not derived from any domain event — purely decorative at present.
- **Print/receipt output**: `index.css` has a `@media print` block that hides everything except `#print-area`, used by `BillingEstimator.tsx`'s invoice receipt screen and `JobBagManager.tsx`'s tag preview. Any new printable screen should reuse the `#print-area` id convention.
- **URL-driven tab state**: `BillingEstimator.tsx` reads `?tab=history` from `window.location.search` (manually, via `URLSearchParams`, in a `useEffect` with `window.location.search` as a dependency — not `useSearchParams` from react-router) to decide whether to show the "create invoice" or "registry" tab. Prefer `useSearchParams` for any new tab-in-URL feature to stay consistent with the router already in use.

## 6. Build & Environment

- `vite.config.ts` supports a `DISABLE_HMR` env var (Google AI Studio's agent-editing environment disables HMR/file-watching to avoid flicker during automated edits) — irrelevant to normal local development, safe to ignore.
- `.env.example` references `GEMINI_API_KEY` and `APP_URL`, both unused by any code in `src/` currently.
- No test runner, no CI config, no linter config exists in this repo yet (see `TODO.md`).
