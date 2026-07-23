---
name: Aurelian Ledger
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#404944'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#707974'
  outline-variant: '#bfc9c3'
  surface-tint: '#2b6954'
  primary: '#003527'
  on-primary: '#ffffff'
  primary-container: '#064e3b'
  on-primary-container: '#80bea6'
  inverse-primary: '#95d3ba'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#2b2858'
  on-tertiary: '#ffffff'
  tertiary-container: '#413f70'
  on-tertiary-container: '#b0ace5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f0d6'
  primary-fixed-dim: '#95d3ba'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#0b513d'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#e3dfff'
  tertiary-fixed-dim: '#c4c1fb'
  on-tertiary-fixed: '#181445'
  on-tertiary-fixed-variant: '#444173'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  status-in-stock: '#10B981'
  status-sold: '#64748B'
  status-memo: '#F59E0B'
  status-error: '#EF4444'
  weight-numeric: '#0F172A'
  rate-ticker-bg: '#1E1B4B'
typography:
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-numeric-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  data-numeric-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  data-density-sm: 8px
  data-density-md: 16px
---

## Brand & Style
The design system is engineered for the high-stakes environment of Indian Jewellery ERP, where physical weight and financial value are dual-class citizens. The brand personality is **Precise, Authoritative, Secure, and Premium**. It balances the legacy of the jewellery trade with the uncompromising accuracy of modern SaaS.

The chosen style is **Modern Luxury**. This approach combines the cleanliness of high-end minimalism with the structural integrity of corporate design. We utilize generous whitespace and a restricted palette to ensure that critical data—such as purity percentages, HUIDs, and grammage—remains the focus. Subtle gold accents are used strategically as a "nod to the craft," while the overall interface maintains the "Financial Fortress" aesthetic required for enterprise trust and regulatory compliance.

## Colors
The color strategy reinforces the "Dual-Ledger" philosophy. 

- **Primary (Deep Emerald):** Represents growth, legacy, and the stability of the enterprise. Used for primary navigation, main actions, and headers.
- **Secondary (Brushed Gold):** A functional accent color. It should be used sparingly for high-value highlights, live rate tickers, and premium certification badges.
- **Tertiary (Royal Indigo):** Used for data-heavy backgrounds or sidebar elements to provide a sense of security and depth.
- **Neutral (Slate White):** The foundation of the UI, ensuring that weight and money numbers are high-contrast and legible.

**Functional Color Logic:**
- **Green/Emerald:** Available stock and verified compliance (GST/PAN).
- **Amber/Gold:** Pending states (Memo-out) or live market fluctuations.
- **Red/Error:** Weight discrepancies, staleness warnings, or "Fat-Finger" rate alerts (>5% deviation).

## Typography
The typography system is split between brand elegance and data precision.

1.  **Brand Serif (Playfair Display):** Reserved for page titles, section headers, and "Luxury" contexts like customer profiles or high-value invoice summaries.
2.  **UI Sans (Plus Jakarta Sans):** The workhorse font for the ERP. It must utilize **tabular numerals** (monospace numbers) for all weight (3 decimals) and currency (2 decimals) columns to ensure perfect vertical alignment in ledgers.
3.  **Monospace (JetBrains Mono):** Used strictly for technical identifiers such as **HUIDs (6-char alphanumeric)**, Barcodes, HSN codes, and Audit Logs. This prevents character confusion (e.g., '0' vs 'O').

**Numeric Priority:** Critical weight numbers (e.g., 22.450g) should use `data-numeric-lg` with a slightly tighter letter spacing but full tabular alignment.

## Layout & Spacing
The system utilizes a **Fixed Grid** on desktop to maintain the "Dashboard" feel, while reflowing to a single-column fluid layout for mobile sales tablets.

**The Dual-Ledger Grid:**
Complex data tables must follow a strict vertical rhythm. We use a 12-column grid system where the "Weight Ledger" (Gross, Stone, Net) and "Money Ledger" (Rate, Making Charge, Tax) are visually grouped using internal padding and subtle vertical dividers.

**Density:**
As a retail management tool, the system defaults to "Compact" density. Spacing units are based on an 8px scale. For POS interfaces, touch targets for the numeric keypad are increased to 48px minimum.

**Rate Staleness Indicator:**
The layout includes a persistent 40px "Global Banner" slot at the top of the viewport. If market rates are outdated, this banner pushes the entire UI down, serving as a mandatory visual interrupt.

## Elevation & Depth
Elevation is used functionally to signify "Compliance Gates" and focused workflows.

- **Tonal Layers:** We use surface-container tiers (Primary Surface: #FFFFFF; Secondary Surface: #F8FAFC) to differentiate between the navigation and the working ledger.
- **Low-Contrast Outlines:** Instead of heavy shadows, cards and table headers use 1px borders (#E2E8F0). This keeps the UI feeling light and fast.
- **The "Audit" Overlay:** Modals for Rate Overrides or Quick-Add Customer use a high-contrast backdrop blur (8px) to isolate the user from the dense background data, signaling a moment of high accountability.
- **Shadows:** Only used for floating elements like the "Search-by-Mobile" dropdown or real-time notification toasts, using a soft, low-opacity Deep Emerald tint to maintain brand cohesion.

## Shapes
The shape language is **Soft (0.25rem / 4px)**. 

Sharp corners feel too aggressive for a luxury brand, but large "pill" shapes feel too casual for a financial tool. The 4px radius provides a professional, modern finish that feels precise and structured. 

- **Standard Buttons & Inputs:** 4px radius.
- **Status Badges:** 2px radius (near-sharp) to distinguish them as technical labels rather than interactive buttons.
- **Image Containers:** 8px radius (rounded-lg) to soften the display of jewellery photography.

## Components

### Complex Data Tables (Ledgers)
- **Header:** Sticky headers with Deep Emerald text. 
- **Alignment:** Alphanumeric text is left-aligned; all Weight and Currency data is right-aligned using tabular numerals.
- **Zebra Striping:** Use #F8FAFC on even rows to help eye-tracking across wide ledgers.

### Live Rate Tickers
- **Style:** Housed in the top utility bar or sidebar. Uses Royal Indigo background with Brushed Gold text.
- **Motion:** Value changes trigger a 500ms background flash (Green for down, Red for up) to alert the user without interrupting the flow.

### Status Badges (Tagging State)
- **In Stock:** Emerald background, white text.
- **Sold:** Slate grey background, white text.
- **Memo:** Gold border, Gold text (ghost style).
- **HUID Verified:** A small "Seal" icon next to the monospace ID.

### Input Fields & Keypads
- **Validation:** High-visibility "Fat-Finger" flags appear as a red tooltip below the input if a rate change exceeds 5%.
- **Compliance Gates:** Mandatory fields (PAN for >2L) should have a distinct border color to prevent "Hard-Blocks" at the final checkout step.

### Critical Weight Numbers
- Displayed in a "Hero Card" format during weighing-scale integration. The number should be at least 32px, bold, using Deep Emerald to ensure the operator can read it from a distance at the counter.