import type { TagStatus } from './lib/tagStateMachine';
import type { PaymentSplitEntry } from './lib/billingCalculations';
import type { OverrideRecord } from './lib/priceOverrides';
import type { PanDeclaration } from './lib/statutoryChecks';

export type ItemCategory = 'Rings' | 'Necklaces' | 'Earrings' | 'Bangles' | 'Bracelets' | 'Chains' | 'Coins';
export type MetalStandard = 'Gold (24K)' | 'Gold (22K)' | 'Gold (18K)' | 'Silver (999)' | 'Platinum (950)';
export type StoneVariety = 'None' | 'Diamond' | 'Ruby' | 'Emerald' | 'Sapphire' | 'Cubic Zirconia';

/**
 * The design *template* (PRD §4.3, Handbook Phase 2 §2.5) — category, defaults, images.
 * Never carries actual weight or stock status; see `Tag` for the individually-weighed,
 * sellable physical piece. Handbook D-6.
 */
export interface ItemDesign {
  id: string;
  designCode: string;
  name: string;
  category: ItemCategory;
  metalType: MetalStandard;
  defaultWastagePercent: number; // in %
  defaultMakingChargeType: 'per-gram' | 'flat';
  defaultMakingChargeValue: number; // currency amount
  defaultStoneType: StoneVariety;
  hsnCode?: string;
  imageUrl?: string;
  isActive: boolean;
}

/**
 * The atomic, individually-weighed, sellable physical piece (PRD §5.1-5.2, Handbook Phase 3).
 * Always instantiated from an `ItemDesign`, but carries its own actual weights, stones,
 * HUID, and stock-ownership financing type — no two Tags of the same design are identical.
 */
export interface Tag {
  id: string;
  sku: string;
  itemDesignId: string;
  name: string;
  category: ItemCategory;
  metalType: MetalStandard;
  grossWeight: number; // in grams
  netWeight: number; // in grams
  wastagePercent: number; // in %, defaults from ItemDesign, overridable per physical piece
  makingChargeType: 'per-gram' | 'flat';
  makingChargeValue: number; // currency amount
  stoneType: StoneVariety;
  stoneWeight: number; // in carats
  stoneCharge: number; // currency amount
  certificateNo?: string;
  huid?: string; // 6-char BIS Hallmark Unique ID, assigned once hallmarked (Milestone 24/Phase 9)
  stockOwnershipType: 'OWNED' | 'GML_FINANCED' | 'CONSIGNMENT'; // Handbook §1.6/D-3
  status: TagStatus; // enforced lifecycle, see lib/tagStateMachine.ts (Milestone 4, Handbook D-6)
  imageUrl?: string;
  /** Which branch physically holds this piece (Milestone 19). Absent = pre-M19 record. */
  branchId?: string;
}

/**
 * Branch / Location Master (PRD §2/§4.8, Handbook §2.10, Milestone 19).
 *
 * D-1: architected for a multi-branch regional chain, with branch-wise GSTIN mandatory from
 * the start. D-5: Party Master (Customer/Karigar) and the Metal/Purity Master are explicitly
 * NOT branch-scoped — see `src/lib/branch.ts` for why that matters.
 */
export interface Branch {
  id: string;
  branchCode: string; // e.g. MUM-01
  name: string;
  address: string;
  gstin: string;
  /** GST state code — Milestone 21 compares this to the customer's to pick CGST+SGST vs IGST. */
  stateCode: string;
  /** Each GSTIN needs its own consecutive tax-invoice series (GST Rule 46). */
  invoiceSeriesPrefix: string;
  defaultStockOwnershipType: 'OWNED' | 'GML_FINANCED' | 'CONSIGNMENT';
  isActive: boolean;
  /** Permissioned branch-level rate override (D-1); HQ rate applies when absent. */
  rateOverrides?: Record<string, number>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  loyaltyPoints: number;
  lifetimeSpend: number;
  savingsSchemeActive: boolean;
  savingsSchemeMaturityDate?: string;
  savingsSchemeBalance?: number;

  // Milestone 21 — GST place-of-supply. Optional because most retail buyers are walk-ins
  // with no state on file, and PRD §7.3 says to default those to the shop's own state
  // (intra-state) rather than guessing. Deliberately NOT branch-scoped, per decision D-5.
  stateCode?: string; // GST state code, e.g. '27' Maharashtra, '29' Karnataka
  gstin?: string; // only for a B2B buyer; Rule 46 requires it printed on the invoice
}

export interface Karigar {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  metalBalance: number; // outstanding pure gold balance issued to them (in grams)
  laborChargesOwed: number; // money owed to them
  rating: number;
}

/**
 * Append-only Karigar ledger (PRD §6.2, Milestone 16, closes KNOWN_ISSUES #10).
 * Entries are never edited or deleted — a correction is a new, opposing entry.
 *
 * Decision D-2: Weight and Money are two parallel ledgers that never net against each other,
 * so an entry carries EITHER `fineWeightDelta` OR `moneyDelta`, never both.
 */
export type KarigarLedgerEntryType =
  | 'METAL_ISSUED' // fine grams the karigar now owes the shop (+weight)
  | 'METAL_RETURNED' // finished goods received back (−weight)
  | 'WASTAGE_ALLOWED' // agreed wastage the shop absorbs (−weight)
  | 'WASTAGE_EXCESS_WRITTEN_OFF' // excess written off after owner review (−weight)
  | 'SCRAP_RETURNED' // unused metal / filings returned by the karigar (−weight)
  | 'LABOUR_CHARGED' // making charges the shop now owes (+money)
  | 'LABOUR_PAID'; // payout to the karigar (−money)

export interface KarigarLedgerEntry {
  id: string;
  karigarId: string;
  date: string;
  /** Tie-break for entries sharing a date, so statement order is deterministic. */
  sequence: number;
  type: KarigarLedgerEntryType;
  narration: string;
  workOrderId?: string;

  // Weight ledger — fine (24K-equivalent) grams. Positive = karigar owes the shop more.
  fineWeightDelta?: number;
  /** Provenance for the weight figure, so the fine-gold maths is auditable (D-2). */
  grossWeight?: number;
  purityPercent?: number;

  // Money ledger — rupees. Positive = the shop owes the karigar more.
  moneyDelta?: number;
}

/**
 * Unified Karigar Job-Work aggregate (Milestone 17, Handbook §2.5 / DATABASE.md §1.1).
 *
 * `WorkOrder` (the ledger/financial view in KarigarManager) and `JobBag` (the production-floor
 * view in JobBagManager) were two disconnected models describing the SAME real-world thing:
 * metal issued to an artisan to make a piece by a due date. Keeping them separate meant the
 * same job could drift out of sync between the two screens, with no shared identity or FK.
 *
 * They are now one record with two dimensions:
 *  - financial: goldIssued / finishedWeight / labour, which drives the Milestone 16 ledger
 *  - production: stage / priority / stage-wise metal loss, which drives the kanban board
 */
export type JobWorkStage =
  | 'Issued'
  | 'Casting'
  | 'Filing'
  | 'Setting'
  | 'Polishing'
  | 'Hallmark'
  | 'Completed';

export type JobWorkPriority = 'Normal' | 'Urgent' | 'Express';

/** Whether the finished piece has been booked back against the karigar's ledger. */
export type JobWorkReceiptStatus = 'Pending' | 'Received';

export interface JobWork {
  id: string;
  jobNo: string; // JOB-<year>-n — replaces the separate orderNo/bagNo series
  karigarId: string;
  karigarName: string;
  clientName?: string; // set when the piece is a bespoke order for a specific customer
  designName: string;
  category: string;

  // Financial dimension — feeds the append-only karigar ledger (Milestone 16)
  metalType: string;
  goldIssued: number; // gross grams issued
  issueDate: string;
  dueDate: string;

  // Production dimension — drives the Job Bags kanban
  stage: JobWorkStage;
  priority: JobWorkPriority;
  stonesIssued: string;
  metalLossRecorded: number; // cumulative stage-wise loss in grams

  // Receipt / reconciliation
  receiptStatus: JobWorkReceiptStatus;
  finishedWeight?: number;
  finishedMetalType?: string; // may differ from what was issued — see Milestone 16
  actualWastage?: number; // fine grams, from assessWastage()
  laborCharge?: number;
  producedTagId?: string; // the real Tag created when the job completes (Handbook D-6)

  /** Set when actual wastage exceeded the agreed cap and needs owner sign-off (Milestone 18). */
  wastageReview?: WastageReview;

  branchId?: string; // Milestone 19 — which branch issued the metal

  notes?: string;
  createdAt: string;
}

/**
 * Excess-wastage review (PRD §6.2, Milestone 18). The PRD requires excess beyond the agreed
 * slab to be "flagged for owner review (possible loss/theft indicator)" — not silently
 * absorbed, which is what the code did before Milestone 16 via Math.min().
 */
export type WastageReviewStatus =
  | 'Pending' // awaiting owner decision; the excess still sits on the karigar's balance
  | 'WrittenOff' // shop absorbs it — a ledger entry clears it off the balance
  | 'RecoveredFromKarigar'; // karigar bears it — the excess stays payable

export interface WastageReview {
  excessFineWeight: number;
  wastagePercent: number;
  allowedPercent: number;
  flaggedOn: string;
  status: WastageReviewStatus;
  reviewedOn?: string;
  reviewNote?: string;
}

/** @deprecated Replaced by `JobWork` in Milestone 17. Retained only for reference. */
export interface WorkOrder {
  id: string;
  orderNo: string;
  karigarId: string;
  karigarName: string;
  designName: string;
  category: string;
  goldIssued: number; // in grams
  metalType: string;
  issueDate: string;
  dueDate: string;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Returned';
  finishedWeight?: number;
  actualWastage?: number;
  laborCharge?: number;
  notes?: string;
}

export interface InvoiceItem {
  itemId?: string;
  sku?: string;
  name: string;
  metalType: string;
  netWeight: number;
  wastagePercent: number; // in %, from item master or manually entered
  makingChargeType: 'per-gram' | 'flat';
  makingChargeValue: number; // raw rate (per-gram) or flat amount, as entered
  goldPrice: number; // metal value only (excludes wastage)
  wastageValue: number;
  makingCharge: number; // computed making charge total in currency
  stoneCharge: number;
  subtotal: number;
  overrides?: OverrideRecord[]; // counter-level price overrides + logged reasons (PRD §7.1/§15.1)

  // Milestone 21 — GST Rule 46 requires an HSN code per line. Optional so invoices
  // written before M21 still parse; those fall back to the composite jewellery rate.
  hsnCode?: string;
  gstRatePercent?: number; // the rate in force on the invoice date, captured at billing time
}

/**
 * An ESTIMATE is a non-fiscal quotation (PRD §7.8): same calculation engine, but it consumes
 * no tax-invoice number, deducts no stock, and skips the statutory gates. A TAX_INVOICE is
 * the real, GST-compliant document. Estimates convert into tax invoices; never the reverse.
 */
export type InvoiceType = 'ESTIMATE' | 'TAX_INVOICE' | 'CREDIT_NOTE';

export interface SaleInvoice {
  id: string;
  invoiceType: InvoiceType;
  invoiceNumber: string; // "INV-<FY>-n" for tax invoices, "EST-<FY>-n" for estimates (separate sequences)
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  oldGoldWeight: number; // trade-in weight
  oldGoldValue: number; // trade-in buyback value, settled at payment stage only
  subtotal: number; // pre-discount sum of line items (metal + wastage + making + stones)
  tax: number; // GST, computed on (subtotal - discount) per PRD §7.4 — never reduced by old gold
  discount: number;
  grandTotal: number; // compliant tax invoice total = (subtotal - discount) + tax
  netAmountDue: number; // grandTotal - oldGoldValue: actual cash/digital amount collected
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Scheme Redemption' | 'Mixed';
  paymentSplit?: PaymentSplitEntry[]; // multi-tender breakdown (PRD §7.5); single-mode bills record one entry
  panDeclaration?: PanDeclaration; // the PAN/Form 60 actually captured at/above the Rule 114B threshold
  convertedToInvoiceNumber?: string; // set on an ESTIMATE once it has been converted
  convertedFromEstimateNumber?: string; // set on a TAX_INVOICE created by converting an estimate

  // Sales Return / Credit Note (CGST Act §34, Milestone 12). A CREDIT_NOTE carries negative
  // figures throughout, so it can be summed alongside invoices to give net revenue directly.
  creditNoteAgainstInvoice?: string; // on a CREDIT_NOTE: the original tax invoice number
  creditNoteAgainstInvoiceDate?: string; // §34 requires the original invoice's date too
  returnedLineIndexes?: number[]; // on a CREDIT_NOTE: which original lines it reverses
  branchId?: string; // Milestone 19 — the branch (and therefore GSTIN) that raised this document
  creditNoteNumbers?: string[]; // on a TAX_INVOICE: every credit note raised against it
  returnedLineIndexesCovered?: number[]; // on a TAX_INVOICE: lines already credited, so they can't be returned twice
  returnReason?: string;

  // Milestone 21 — statutory tax breakdown (PRD §7.3/§9.3). All optional so invoices
  // persisted before M21 still load; `tax` above remains the combined total, and
  // cgst + sgst + igst always sums to exactly that figure.
  cgst?: number;
  sgst?: number;
  igst?: number;
  placeOfSupplyStateCode?: string; // the customer's state, which decides the split
  supplyType?: 'INTRA_STATE' | 'INTER_STATE';
  roundOff?: number; // PRD §7.3: Round(Total) - Total, its own accounting ledger

  // Milestone 22 — simulated e-Invoice registration (PRD §9.4). Absent on documents
  // raised before M22 and on estimates, which are never registered.
  eInvoice?: EInvoiceRecord;
}

/**
 * e-Invoice registration state (PRD §9.4, Milestone 22). SIMULATED — there is no GSP/NIC
 * integration; see the header of `src/lib/eInvoice.ts`. `NOT_APPLICABLE` covers estimates,
 * which are quotations rather than supplies and never get an IRN.
 */
export type EInvoiceStatus = 'NOT_APPLICABLE' | 'PENDING' | 'GENERATED' | 'FAILED' | 'CANCELLED';

export interface EInvoiceRecord {
  status: EInvoiceStatus;
  attempts: number; // retry count — PRD §9.4 requires a queue/retry for portal downtime
  irn?: string; // 64-hex Invoice Reference Number
  ackNo?: string;
  ackDate?: string; // starts the 24-hour cancellation window
  signedQrPayload?: string;
  failureReason?: string;
  cancelledOn?: string;
  cancelReason?: string;
}

/** e-Way Bill for a goods movement (PRD §9.5, Milestone 22). */
export interface EWayBill {
  ebn: string; // 12-digit e-Way Bill number
  generatedOn: string;
  validUntil: string;
  transporterName: string;
  vehicleNumber: string;
  distanceKm: number;
  declaredValue: number;
}

/**
 * Tax Master row (PRD §9.2, Milestone 21). Append-only with effective-date versioning:
 * a rate change is a NEW row, and the previous row is closed with an `effectiveTo` rather
 * than overwritten — re-printing an old invoice must resolve the rate that applied on its
 * own date, not today's. PRD §9.2 is explicit that these must never be hardcoded.
 */
export interface TaxRate {
  id: string;
  hsnCode: string; // HSN for goods, SAC for services (e.g. 9988 job work)
  description: string;
  gstRatePercent: number; // composite rate; CGST/SGST each take half on an intra-state sale
  effectiveFrom: string; // ISO date
  effectiveTo?: string; // absent = still in force
  isService?: boolean; // true for a SAC row
  notificationRef?: string; // the GST Council notification this rate came from
}

/**
 * Old Gold buyback (PRD §8, Milestone 14). This is a PURCHASE transaction, not a sale-side
 * discount (§8.3 / decision D-10) — it gets its own OGV- voucher series and is netted against
 * a linked invoice only at the settlement stage, if at all.
 */
export type OldGoldSettlementMode = 'CASH' | 'BANK' | 'ADJUSTED_AGAINST_INVOICE';

/** Vault lifecycle for a received lot (PRD §8.2 step 7 / §6.3, Milestone 15). */
export type OldGoldLotStatus = 'InSafe' | 'SentForMelting' | 'Melted' | 'FineGoldStock' | 'ResaleAsIs';

export interface OldGoldVoucher {
  id: string;
  voucherNumber: string; // OGV-<year>-n, its own series (a purchase, not a sale)
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  panNumber?: string; // §8.4 treats old-gold intake as a purchase requiring KYC
  itemDescription: string;

  // Valuation inputs and outputs (PRD §8.2 steps 2-4)
  grossWeight: number;
  testedPurityPercent: number;
  meltingLossPercent: number;
  netPayableWeight: number;
  buybackRatePerGram: number;
  buybackValue: number;

  settlementMode: OldGoldSettlementMode;
  linkedInvoiceNumber?: string; // set when adjusted against a sale (§8.4)

  // Vault tracking (Milestone 15)
  status: OldGoldLotStatus;
  recoveredFineWeight?: number; // actual fine gold recovered once melted
  meltedOn?: string;
  branchId?: string; // Milestone 19
}

/**
 * Inter-Branch Stock Transfer (PRD §2/§9.5, Milestone 20).
 *
 * While `InTransit` the moved Tags sit in `TransferInTransit`, which is not a sellable state —
 * so the pieces are invisible to BOTH branches until accepted somewhere. That is decision D-7
 * ("a tag can never be sellable at two branches simultaneously") enforced structurally.
 */
export type StockTransferStatus =
  | 'Draft'
  | 'InTransit'
  | 'Received'
  | 'PartiallyReceived'
  | 'Rejected';

export interface StockTransfer {
  id: string;
  transferNo: string; // TRF-<year>-n — a delivery-challan series, not a tax-invoice series
  fromBranchId: string;
  toBranchId: string;
  tagIds: string[];
  status: StockTransferStatus;
  createdOn: string;
  dispatchedOn?: string;
  receivedOn?: string;
  /** Declared consignment value at dispatch, for the e-Way Bill threshold (PRD §9.5). */
  declaredValue?: number;
  eWayBillRequired?: boolean;
  /** Set on receipt: which pieces the destination actually accepted. */
  eWayBill?: EWayBill; // Milestone 22 — generated for a movement over the threshold
  acceptedTagIds?: string[];
  rejectedTagIds?: string[];
  rejectionReason?: string;
  notes?: string;
}

export interface MetalRate {
  id: string;
  metalType: string;
  purity: string;
  ratePerGram: number;
  change24h: number; // percentage
  history24h: number[]; // 8 data points for sparkline
}

export interface LooseStone {
  id: string;
  lotNo: string;
  stoneType: 'Diamond' | 'Ruby' | 'Emerald' | 'Sapphire' | 'Pearl' | 'Opal';
  cut: 'Round Brilliant' | 'Oval' | 'Marquise' | 'Emerald' | 'Pear' | 'Princess' | 'Cushion';
  color: string;
  clarity: string;
  caratWeight: number;
  quantity: number;
  valuePerCarat: number;
  totalValue: number;
  certification: 'GIA' | 'IGI' | 'HRD' | 'SGL' | 'None';
  certificateNo?: string;
  status: 'In Vault' | 'Issued' | 'Sold';
  assignedKarigarName?: string;
  branchId?: string; // Milestone 19
}

export interface JobBag {
  id: string;
  bagNo: string;
  clientName: string;
  designName: string;
  currentStage: 'Casting' | 'Filing' | 'Setting' | 'Polishing' | 'Hallmark' | 'Completed';
  priority: 'Normal' | 'Urgent' | 'Express';
  metalType: string;
  metalIssuedWeight: number;
  stonesIssued: string;
  assignedKarigarName: string;
  dueDate: string;
  notes?: string;
  metalLossRecorded: number; // in grams
  createdAt: string;
}
