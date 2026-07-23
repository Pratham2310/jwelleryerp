# MODULE_STATUS.md

_Last updated: Detailed Frontend Gap Analysis Pass (comparing Codebase vs PRD vs Developer Handbook vs Stitch UI)._

## Legend
- **Not Started**: No UI screen, component, or logic implemented.
- **UI Mockup Only**: Visual layout exists, but lacks real underlying domain model, data persistence, or business rules.
- **Partial / Incorrect**: Functional UI exists, but contains domain correctness bugs or missing sub-features (see `KNOWN_ISSUES.md`).
- **Done**: Fully production-ready, validated frontend module matching PRD & Handbook specifications.

---

## Detailed PRD Module & Handbook Phase Implementation Matrix

| PRD Module (§) | Handbook Phase | Current UI Status | Detailed Gap & Missing Frontend Features Analysis |
|---|---|---|---|
| **1. Domain Glossary & Metal Standards** | Phase 1 (Drafted) | **UI Mockup Only** | Supports basic metal types in dropdown. Missing: 14K Gold (58.5%), Sterling Silver (925), Fine Gold (24K equivalent) weight calculation displays, multi-metal composition UI. |
| **2. Multi-Branch & Location System** | Phase 2 (Drafted) | **Not Started** | Hardcoded `STORE: MUM-01` in Sidebar. Missing: Branch Switcher dropdown in Header, Multi-branch inventory view, Inter-Branch Stock Transfer (IBST) request/approval UI, Branch-specific rate overrides, Counter/Vault location assignment. |
| **3. Personas & RBAC Roles** | Phase 12 (Undrafted) | **UI Mockup Only** | Login screen has cosmetic role text. Missing: Admin Role & Permission Management screen, Supervisor PIN / Authorization Modal for rate overrides / discounts / cancellations, role-based component/route visibility guards. |
| **4.1 Metal Master & Rate Master** | Phase 2 (Drafted) | **Partial / Incorrect** | Rates editable via Dashboard ticker. Missing: Append-only Rate History log modal/tab, Rate change sanity alert (>2% guard), scheduled rate changes, branch-wise rate matrix, live IBJA feed sync UI. |
| **4.2 Item / Design Master** | Phase 2 (Drafted) | **UI Mockup Only** | Conflates `ItemDesign` (template) and `Tag` (physical piece). Missing: Dedicated Item Design catalog management UI, subcategories, gender/occasion tags, default making charge & wastage schemes per design, image gallery upload. |
| **4.3 Party Master (Customer/Karigar/Supplier)** | Phase 2 (Drafted) | **Partial** | Basic Customer and Karigar directory. Missing: Vendor & Bullion Dealer directory UI, mandatory KYC fields (PAN, GSTIN, Aadhaar, PMLA Risk Tier), PAN missing alert for high spend, unified Party Ledger view. |
| **4.4 Making Charge & Wastage Master** | Phase 2 (Drafted) | **Not Started (as Master)**| Values typed ad-hoc per item/billing line. Missing: Making Charge Slabs Master UI (per gram, % of gold value, flat per piece, combined MC+Wastage), Wastage Slabs Master UI, 3-tier override indicator (System default -> Design template -> Tag override). |
| **4.5 Stone & Diamond Rate Master** | Phase 2 (Drafted) | **Partial** | `StoneManager.tsx` tracks vault inventory. Missing: 4Cs Diamond Rate Card / Matrix pricing UI (Cut, Color, Clarity, Carat slab rates), auto-pricing of stones in billing, GIA/IGI certificate PDF viewer & attachment. |
| **4.6 Tax Master** | Phase 2 (Drafted) | **Not Started** | Flat hardcoded `0.03` GST constant in billing. Missing: Tax Master management screen (HSN 7113 @ 3%, HSN 7102 @ 1.5%, HSN 9988 @ 5%), CGST+SGST vs IGST split rules based on place of supply, TCS (1% cash > ₹5L) master, RCM setup. |
| **4.7 Branch / Location Master** | Phase 2 (Drafted) | **Not Started** | No branch entity in UI. Missing: Branch Master setup (Branch Name, Address, GSTIN, Counter / Safe / Vault sub-locations, Cash counter limits). |
| **5. Inventory & Atomic Tagging** | Phase 3 (Drafted) | **UI Mockup Only** | `JewelleryItem` stores single weight. Missing: Atomic Tag management UI, Tag status state machine (`CREATED` -> `IN_STOCK` -> `IN_SHOWCASE` -> `RESERVED` -> `SOLD` -> `MELTED`), Thermal Tag Printer Layout Designer & Sticker Generator, Stock Ownership Tag (`OWNED`, `GML_FINANCED`, `CONSIGNMENT`), Physical Stock Audit barcode scan UI. |
| **6. Procurement & Karigar Job-Work** | Phase 4 (Undrafted) | **Partial (Split UI)** | `KarigarManager.tsx` and `JobBagManager.tsx` are unlinked. Missing: Unified Job Bag + Work Order UI, Karigar Fine Gold (24K) running ledger, Scrap & Unused Stone return modal, Wastage Cap breach alert, Raw Bullion intake UI. |
| **7. Billing & POS Calculation Engine** | Phase 5 (Undrafted) | **Partial / Incorrect** | Functional UI in `BillingEstimator.tsx`, but has compliance bugs (`KNOWN_ISSUES.md` #1-4). Missing: Split GST/HSN per line, Mandatory PAN Verification Modal (>=₹2L), Multi-Payment Split UI (Cash+Card+Scheme+OldGold), Proforma Estimate vs Tax Invoice mode, Sales Return / Credit Note UI. |
| **8. Old Gold & Silver Exchange** | Phase 6 (Undrafted) | **Incorrect (Compliance)**| Currently subtracted directly from sales subtotal before GST. Missing: Separate Old Gold Purchase Voucher UI, Melting & Touch Purity Valuation Calculator (Gross Wt, Melt Loss %, Touch %, Fine Gold Yield), Scrap Gold Inventory vault status. |
| **9. GST Compliance Module** | Phase 7 (Undrafted) | **Not Started** | Missing: GSTIN lookup validator, e-Invoice (IRN) generation & QR code render on print, e-Way Bill auto-trigger form (>₹50,000 transport), GSTR-1 & GSTR-3B preview tables & JSON export. |
| **10. Accounting & Financial Ledgers** | Phase 8 (Undrafted) | **Not Started** | Missing: Chart of Accounts UI, Customer / Karigar / Supplier General Ledger Statement UI, Day Book & Cash/Bank Book UI, Auto-Journal Voucher preview, Tally Prime XML Export UI. |
| **11. BIS Hallmarking & HUID** | Phase 9 (Undrafted) | **UI Mockup Only** | HUID is a static text field. Missing: AHC (Assaying & Hallmarking Centre) Dispatch Batch UI, AHC Receipt & 6-digit HUID tag assignment UI, Sale Block Alert preventing billing of un-hallmarked gold items (PRD §11.4). |
| **12. Gold Savings Scheme (Swarna Nidhi)**| Phase 10 (Undrafted) | **Partial / Incorrect** | Customer scheme balance display exists, but scheme redemption billing doesn't debit balance (`KNOWN_ISSUES.md` #5). Missing: Scheme Plan Enrollment Modal (11+1 cash bonus vs monthly gold weight), Passbook Print UI, Legal Cash-Refund Hard Block Warning UI (Banning of Unregulated Deposit Schemes Act). |
| **13. CRM, Loyalty & Rate Alerts** | Phase 11 (Undrafted) | **Partial** | Loyalty points accrue on spend. Missing: Customer 360 View (purchase history, family birthdays/anniversaries, ring sizes), WhatsApp/SMS Rate Alert subscription UI, Automated Campaign message preview sender. |
| **14. Reports, Analytics & Dashboards** | Phase 11 (Undrafted) | **Partial** | Dashboard has 4 KPI cards. Missing: Comprehensive Reports Hub (Daily Sales Summary, Stock Ageing >90/180 days, Karigar Reconciliation, Gross Margin Realization, GST & Statutory Tax Reports, Audit Trail Log). |
| **15. Security & Statutory Hooks** | Phase 12 (Undrafted) | **Not Started** | Missing: Statutory Parameters Config UI (PAN/TCS/PMLA thresholds), Detailed Audit Trail & Change Log Viewer, Maker-Checker Approval Queue for high-value operations. |
| **16. Hardware & Offline Integration** | Phase 13 (Undrafted) | **UI Mockup Only** | Simulation Desk exists. Missing: Digital Weighing Scale live connection indicator & Fetch Weight button, Thermal Barcode Tag Printer Layout designer, Handheld Scanner listener, Offline POS Queue Sync UI. |
