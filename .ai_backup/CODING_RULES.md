# CODING_RULES.md

Conventions this codebase actually follows today, plus explicit calls on where an inconsistency exists and which side to follow going forward. Follow these for any new code in this repo unless a task explicitly calls for the larger refactor noted in `TODO.md`.

## 1. Language & Types
- TypeScript everywhere, `.tsx` for anything rendering JSX, `.ts` for pure logic/data/types.
- Domain shapes live in `src/types.ts` as `interface`s — one interface per domain entity, no shared base types, no generics. Follow this flat-interface style for new entities rather than introducing a different modeling approach (e.g. Zod schemas, class-based models) unless doing the backend/schema migration described in `DATABASE.md`.
- Component props are typed via a dedicated `interface {ComponentName}Props` directly above the component, not inline destructured types.
- Prefer `React.Dispatch<React.SetStateAction<T>>` for setter props passed down from a lifted-state parent (the established pattern — see `setItems`, `setCustomers`, etc. throughout).

## 2. State Management — Follow the Lifted-State Pattern
**Rule:** New domain entities/state must be lifted to `App.tsx` and prop-drilled down, mirrored to `localStorage` via a dedicated `useEffect`, matching `metalRates`/`items`/`customers`/`karigars`/`workOrders`/`invoices`.
**Do not** introduce another component-local, independently-`localStorage`-backed entity the way `StoneManager.tsx` (`LooseStone[]`) and `JobBagManager.tsx` (`JobBag[]`) currently do — this is a known inconsistency (`KNOWN_ISSUES.md` #8), not a pattern to extend. If a task involves touching stone or job-bag data meaningfully, lifting that state to `App.tsx` (and updating `ROUTING.md`'s prop table) is in scope as part of the fix, not scope creep.

`localStorage` key naming convention: `stitch_{snake_case_entity_name}` (e.g. `stitch_jewellery_items`, `stitch_loose_stones`). Follow this for any new persisted key.

## 3. Theming
**Do not** copy-paste the `useState` + `MutationObserver` theme-detection boilerplate into a new component (see `FRONTEND_ARCHITECTURE.md` §4 for what it looks like and why it exists six-plus times already). If a new component needs the current theme:
- Prefer extracting a shared `useTheme()` hook (reading `localStorage['stitch_theme']` + observing the same `MutationObserver`) and have all components — old and new — migrate onto it as time allows (tracked in `TODO.md`).
- If a minimal-diff fix is required right now, it is acceptable to add the existing boilerplate once more, but leave a comment noting it should migrate to the shared hook when one exists.

## 4. Styling
- Utility-first Tailwind, no CSS Modules, no styled-components.
- Tailwind v4 CSS-first config — **do not add a `tailwind.config.js`**; new design tokens belong in the `@theme` block in `src/index.css`.
- **Preferred path for new UI:** build with the `ui/` primitives (`Button`, `Input`, `Card`, `Badge`) and the literal brand hex values (`#C5A059` gold, `#141416` surface, `#262626` border, etc.), matching `Sidebar.tsx`/`Header.tsx`/the auth pages — **not** the raw-Tailwind-slate-plus-global-override pattern the eight business screens currently use (`COMPONENT_LIBRARY.md` §3). If extending an existing raw-Tailwind screen with a new element, stick to Tailwind shade names already covered by an override rule in `index.css` (audit before introducing an uncovered one, e.g. a `bg-orange-*` outside the one existing usage).
- Use `cn()` from `src/lib/utils.ts` for any conditional/merged class list, never manual string concatenation.
- Icons: `lucide-react` only, for consistency with the rest of the app.
- Currency/weight formatting: always `.toLocaleString('en-IN')` for money and weights, never a bare `.toString()` or default-locale `.toLocaleString()`. Currency symbol is a literal `₹` prefix, not `Intl.NumberFormat` currency style (the codebase's existing convention — follow it rather than introducing `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` inconsistently alongside the existing literal-prefix style, unless doing a deliberate, repo-wide formatting refactor).
- Numeric/technical/ID text uses `font-mono`; everything else uses the default sans (Inter).

## 5. Routing
- `react-router-dom` v7 with `HashRouter`. New routes: add to `App.tsx`'s authenticated `<Routes>` block **and** to `Sidebar.tsx`'s `menuItems` array (there's no shared route-config source of truth — see `ROUTING.md` §4).
- Prefer `useSearchParams`/`useNavigate`/`useLocation` from `react-router-dom` for any new URL-state need, rather than the manual `window.location.search` parsing seen in `BillingEstimator.tsx` (an existing inconsistency, not a pattern to repeat).

## 6. Domain Calculation Rules (from the PRD — binding regardless of what the current prototype does)
When touching any billing/GST/wastage/making-charge/old-gold logic, the source of truth is **PRD §7 (Billing Engine) and §8 (Old Gold)**, not the current inline implementation in `BillingEstimator.tsx` (which has known bugs — see `KNOWN_ISSUES.md` #1–4). Specifically:
- Compute Metal Value, Wastage Value, and Making Charges as **three separate figures** (PRD §7.2 Steps 2–4), even if the UI later chooses to *display* Wastage merged into Making Charges as "Value Addition %" (PRD §7.2's note) — the underlying calculation must still branch correctly by `makingChargeType` (`per-gram` / `percentage` / `flat`) and use each item's *own* `wastagePercent`, never a hardcoded average.
- GST is computed on the **full** taxable value (metal + wastage + making + stones, minus any bill/line-level *discount*, per §7.4) — **never** minus old-gold trade-in value (D-10 in `DECISIONS.md`).
- Round weights to 3 decimals, rates to 2 decimals, and use round-half-up (not banker's rounding) for final invoice totals (PRD §7.7) — match manual/shop convention, since staff will mentally cross-check totals against a calculator.
- Any new calculation code should be written as a pure, independently unit-testable function (per D-9 in `DECISIONS.md`), not inlined into a component's render logic — this is a prerequisite for eventually testing against the PRD §17 worked example.

## 7. What NOT to Hardcode
Per PRD §9.2 and Handbook §2.9/§2.2, the following must never be literal constants in application code, even in prototype/demo code that might later be copy-pasted into production paths: GST rates, HSN codes, PAN/TCS/PMLA thresholds (₹2,00,000, ₹10,00,000, 1% TCS, etc.), purity fractions, wastage percentages, making-charge slabs. Prefer a lookup against a (even mock/local, for now) master-data structure over a bare number, so the eventual migration to real master tables is a data change, not a code change.

## 8. Comments & Documentation
- The existing codebase favors inline `// comment` explanations at decision points (e.g. `// average default if not specified`) rather than JSDoc blocks — match this lightweight style for now.
- Any deliberate, known-incomplete/incorrect shortcut (like the ones catalogued in `KNOWN_ISSUES.md`) should be flagged with a comment referencing the relevant PRD section, not left silently unexplained, so the gap is discoverable by reading the code alone.
