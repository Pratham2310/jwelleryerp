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
}

/**
 * An ESTIMATE is a non-fiscal quotation (PRD §7.8): same calculation engine, but it consumes
 * no tax-invoice number, deducts no stock, and skips the statutory gates. A TAX_INVOICE is
 * the real, GST-compliant document. Estimates convert into tax invoices; never the reverse.
 */
export type InvoiceType = 'ESTIMATE' | 'TAX_INVOICE';

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
