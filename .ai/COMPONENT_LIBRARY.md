# COMPONENT_LIBRARY.md

## 1. Design Tokens

Defined as literal hex values (not Tailwind theme tokens) scattered across `src/index.css` and component `className` strings — there is no central token file/constants module. The palette:

| Token | Hex | Usage |
|---|---|---|
| App background (dark) | `#0A0A0B` | `html/body/#root`, main canvas |
| Card / surface (dark) | `#141416` | Cards, inputs, sidebar sub-panels |
| Elevated surface (dark) | `#1A1A1D` / `#1C1C1E` | Hover states, nested surfaces |
| Border (dark) | `#262626` | Nearly all borders/dividers |
| Gold accent (brand) | `#C5A059` | Primary brand color — buttons, active nav, focus rings, links |
| Gold hover | `#D9B875` | Hover state of gold accent |
| Primary text (dark) | `#E5E5E5` | Body text |
| Heading text (dark) | `#FFFFFF` | Headings |
| Muted text (dark) | `#71717A` | Labels, captions, placeholder |
| Secondary text (dark) | `#A1A1AA` | Sub-labels |
| App background (light) | `#F6F6F9` | Light theme canvas |
| Border (light) | `#E4E4E7` | Light theme borders |
| Gold accent (light, adjusted for contrast) | `#8C6D34` | Light theme's darker gold for AA contrast on white |

Fonts (imported in `index.css` from Google Fonts):
- **Inter** — `--font-sans`, the only font actually applied anywhere.
- **JetBrains Mono** — `--font-mono`, used for numeric/technical labels (rates, IDs, timestamps) via `font-mono` utility classes — this is a deliberate, consistently-applied design choice (numbers and codes get monospace treatment throughout the app).
- **Space Grotesk** — imported in the `@font-face`/Google Fonts URL but **never referenced by any class or token in the codebase.** Dead import; either use it somewhere intentional (e.g. as a display font for headings) or remove it from the `@import` URL.

## 2. The `ui/` Component Library (`src/components/ui/`)

Four primitives exist:

### `Button.tsx`
```ts
variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger'
size?: 'sm' | 'md' | 'lg' | 'icon'
```
`primary` is actually a dark/slate button (not the brand color); `gold` is the true brand-color CTA button. `React.forwardRef`-wrapped, spreads all native `<button>` props. Focus ring is always gold (`focus:ring-[#C5A059]`) regardless of variant.

### `Input.tsx`
Props: `label?`, `error?`, `icon?` (a `ReactNode` rendered absolutely-positioned inside the field), plus all native `<input>` props. Renders a label row, the input (with optional left icon, `pl-10` when present), and an error message row. `forwardRef`-wrapped.

### `Card.tsx`
Compound component: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`. `Card` takes a `hoverable?: boolean` prop that adds a gold border/glow hover treatment — intended for clickable card grids (e.g. a catalog tile).

### `Badge.tsx`
```ts
variant?: 'success' | 'warning' | 'info' | 'error' | 'gold' | 'default'
```
Pill-shaped, uppercase, monospace label. Note `warning` and `gold` currently resolve to the *identical* style (both gold-tinted) — if a visually distinct "warning" state is ever needed (as opposed to "gold/premium" branding), this will need to be split out.

## 3. ⚠️ Critical Finding: The Component Library Is Barely Used

Only **3 of 15 components** in the codebase actually import from `ui/`:
- `LoginPage.tsx`
- `RegisterPage.tsx`
- `Header.tsx`

**All eight business-module screens** — `Dashboard.tsx`, `CatalogManager.tsx`, `BillingEstimator.tsx`, `KarigarManager.tsx`, `JobBagManager.tsx`, `CustomerManager.tsx`, `StoneManager.tsx`, and `Sidebar.tsx` — build every button, input, card, and badge **from scratch with raw `<div>`/`<button>`/`<input>` elements and inline Tailwind utility classes**, typically using generic Tailwind slate/amber color names (`bg-white`, `border-slate-150`, `text-amber-800`, `bg-slate-900`, etc.) rather than the `#C5A059`/`#141416`/`#262626` literals the `ui/` library and `Sidebar`/`Header` use directly.

**How this still looks visually consistent:** `src/index.css` contains a large block of global `!important` CSS rules (see the "ELEGANT DARK SYSTEM THEME OVERRIDES" and "SYSTEM-WIDE POLISHED LIGHT MODE THEME OVERRIDES" sections) that intercept these generic Tailwind class names at the CSS layer and force them to the correct brand colors — e.g. any element with `.bg-white` gets forced to `#141416` in dark mode, any `.text-amber-500` gets forced to `#C5A059`, etc.

**Why this matters for future work:**
1. It works today, but it's fragile — a developer using a Tailwind class not already covered by an override rule in `index.css` (e.g. `bg-orange-*`, seen once in `CustomerManager.tsx` for a "Bronze" tier badge) will render with un-themed, wrong-looking colors in dark mode, silently, with no type error or lint warning.
2. It means the actual design system "lives" in a CSS override file keyed on Tailwind's default class names, not in the `ui/` component props — two parallel styling systems coexist.
3. Any new screen should either (a) build with the `ui/` primitives directly and extend `index.css` overrides only where the primitives don't yet cover a need, or (b) if continuing the raw-Tailwind-plus-override pattern, stick strictly to the exact slate/amber/emerald/red Tailwind shade names already covered by existing override rules in `index.css` (audit that file before introducing a new shade).
4. **Recommended direction (see `TODO.md`):** migrate the eight raw-Tailwind screens onto the `ui/` primitives incrementally, retiring the override-CSS approach once coverage is complete, so the app has one real design system instead of two.

## 4. Iconography

`lucide-react` is used exhaustively and consistently across every screen — this is the one area of clean, consistent adoption. New icons should be picked from `lucide-react` to match; avoid introducing a second icon library.

## 5. Common Visual Idioms (for consistency in new screens)

- Rounded corners: `rounded-xl` (buttons/inputs), `rounded-2xl` (cards), `rounded-3xl` (large panels like the printable invoice).
- Numeric/currency/ID values are rendered in `font-mono`, with Indian digit grouping via `.toLocaleString('en-IN')` (e.g. `₹${value.toLocaleString('en-IN')}`) — always use `en-IN` locale for money/weight display, never the default locale.
- Status pills follow the `Badge` semantic mapping (success=emerald, warning/gold=amber-gold, info=blue, error=red).
- Every list/table screen follows the same shape: search bar + filter chips → summary/KPI cards → main data table or card grid → a modal (triggered by `isAddModalOpen`-style local or lifted state) for the "add new" form.
