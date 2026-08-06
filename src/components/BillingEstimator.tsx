import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  User, 
  Plus, 
  Trash2, 
  Calculator, 
  Coins, 
  TrendingDown, 
  Printer, 
  ShoppingBag,
  CheckCircle,
  FileCheck,
  Search,
  Percent,
  Eye,
  AlertCircle,
  Calendar,
  Users,
  Sparkles,
  X,
  ShieldAlert,
  ShieldCheck,
  CloudOff
} from 'lucide-react';
import { Tag, Customer, SaleInvoice, InvoiceItem, InvoiceType, Branch, TaxRate, ItemDesign, HallmarkPolicy, StatutoryParameters, ApprovalRecord } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { calculateLineItem, calculateInvoiceTotals, settleOldGold } from '../lib/billingCalculations';
import { isSellable, canTransition } from '../lib/tagStateMachine';
import { nextBranchInvoiceNumber, resolveMetalRate } from '../lib/branch';
import { validatePaymentSplit, type PaymentSplitEntry, type PaymentMode } from '../lib/billingCalculations';
import { isValidPanFormat, validatePanDeclaration, type PanDeclaration } from '../lib/statutoryChecks';
import {
  isPanRequiredFor,
  requiresSupervisorApproval,
  type SupervisorPin,
} from '../lib/statutoryParameters';
import SupervisorPinModal from './SupervisorPinModal';
import { useHardware } from '../contexts/HardwareContext';
import { checkCreditLimit, type CustomerReceipt } from '../lib/receivables';
import { schemeInForce, buildAttribution, type IncentiveScheme } from '../lib/salesAttribution';
import { useNotifications } from '../contexts/NotificationContext';
import { NOTIFY } from '../lib/notifications';
import { detectOverrides, validateOverrideReasons, buildOverrideRecords, OVERRIDE_FIELD_LABEL, type OverrideField } from '../lib/priceOverrides';
import { calculateReturnTotals, validateReturnSelection } from '../lib/salesReturn';
import TaxMasterPanel from './TaxMasterPanel';
import GstReturnsPanel from './GstReturnsPanel';
import { findHallmarkViolations, applyHallmarkGate } from '../lib/hallmarkGuard';
import {
  isEInvoiceApplicable,
  submitForIrn,
  cancelEInvoice,
  canCancelEInvoice,
  hoursUntilCancellationCloses,
} from '../lib/eInvoice';
import { QRCodeSVG } from 'qrcode.react';
import {
  resolveGstRatePercent,
  defaultHsnForLine,
  determineSupplyType,
  gstComponentLabels,
} from '../lib/taxMaster';

interface BillingEstimatorProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  metalRates: { metalType: string; ratePerGram: number }[];
  invoices: SaleInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<SaleInvoice[]>>;
  /** Determines the GSTIN, invoice series and any branch rate override (Milestone 19). */
  activeBranch: Branch | null;
  /** Tax Master rows, append-only with effective-date versioning (Milestone 21, PRD §9.2). */
  taxRates: TaxRate[];
  setTaxRates: React.Dispatch<React.SetStateAction<TaxRate[]>>;
  /** Supplies each line's authoritative HSN classification. */
  itemDesigns: ItemDesign[];
  /** Non-hallmarked sale guard policy (Milestone 25, PRD §11.3). */
  hallmarkPolicy: HallmarkPolicy;
  /** Configured thresholds — PAN and the supervisor-approval limit (Milestone 34). */
  statutoryParameters: StatutoryParameters;
  /** Who may authorise a discount above that limit (Milestone 33). */
  supervisors: SupervisorPin[];
  /** The signed-in person, recorded as the requester on any approval. */
  currentUserName: string;
  onApprovalRecorded: (record: ApprovalRecord) => void;
  /** Milestone 57 — credit exposure is checked against these before a credit sale is allowed. */
  customerReceipts: CustomerReceipt[];
  /** Milestone 58 — who may be credited with the sale, and the scheme that prices it. */
  salespeople: { id: string; name: string }[];
  incentiveSchemes: IncentiveScheme[];
  /** Terminal is offline (Milestone 36): a completed sale is queued rather than registered. */
  isOffline: boolean;
  onQueueSale: (invoice: SaleInvoice) => void;
}

// NOTE: the old shop-wide `nextInvoiceNumber()` was removed in Milestone 19. GST Rule 46
// requires the tax-invoice series to be consecutive PER GSTIN, and each branch has its own
// GSTIN, so numbering now comes from `nextBranchInvoiceNumber()` in lib/branch.ts.

/**
 * Estimates use their own, entirely separate sequence (Milestone 11, PRD §7.8) — a quotation
 * must never consume a GST tax-invoice number, since Rule 46 requires that series to be
 * gap-free and to contain only real supplies.
 */
function nextEstimateNumber(): string {
  const year = new Date().getFullYear();
  const key = `stitch_estimate_seq_${year}`;
  const next = Number(localStorage.getItem(key) || '500') + 1;
  localStorage.setItem(key, String(next));
  return `EST-${year}-${next}`;
}

/**
 * Credit notes require their own consecutive series under CGST Act §34 / Rule 53 — they are
 * distinct fiscal documents and must not share the tax-invoice numbering (Milestone 12).
 */
function nextCreditNoteNumber(): string {
  const year = new Date().getFullYear();
  const key = `stitch_credit_note_seq_${year}`;
  const next = Number(localStorage.getItem(key) || '900') + 1;
  localStorage.setItem(key, String(next));
  return `CRN-${year}-${next}`;
}

/** e-Invoice registration state at a glance (Milestone 22, PRD §9.4). */
function EInvoiceBadge({ invoice }: { invoice: SaleInvoice }) {
  if (!isEInvoiceApplicable(invoice)) {
    // An estimate is a quotation, not a supply — it is never registered.
    return <span className="text-[10px] font-mono text-slate-400">n/a</span>;
  }

  const status = invoice.eInvoice?.status ?? 'PENDING';
  const styles: Record<string, string> = {
    PENDING: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
    GENERATED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    FAILED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
    CANCELLED: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
    NOT_APPLICABLE: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700',
  };
  const label: Record<string, string> = {
    PENDING: 'Not filed',
    GENERATED: 'IRN issued',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    NOT_APPLICABLE: 'n/a',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

/**
 * Statutory tax lines for a STORED invoice (Milestone 21, PRD §7.3/§9.3).
 *
 * Invoices written before Milestone 21 have no cgst/sgst/igst fields, so they fall back to
 * the single combined `tax` figure they were saved with. Never recompute the split from
 * today's Tax Master here — a reprint must show what was actually charged on the day.
 */
function InvoiceTaxLines({ invoice }: { invoice: SaleInvoice }) {
  const isCreditNote = invoice.invoiceType === 'CREDIT_NOTE';
  const money = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const sign = (n: number) => (n < 0 ? '-' : '');

  const hasSplit =
    invoice.cgst !== undefined || invoice.sgst !== undefined || invoice.igst !== undefined;
  const ratePercent = invoice.items[0]?.gstRatePercent ?? 3;
  const labels = gstComponentLabels(
    ratePercent,
    invoice.supplyType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE'
  );

  if (!hasSplit) {
    return (
      <div className="flex justify-between text-slate-500">
        <span>{isCreditNote ? `GST Reversed (${ratePercent}%):` : `Jewelry GST (${ratePercent}% on taxable value):`}</span>
        <span className="font-mono">{sign(invoice.tax)}{money(invoice.tax)}</span>
      </div>
    );
  }

  return (
    <>
      {invoice.supplyType === 'INTER_STATE' ? (
        <div className="flex justify-between text-slate-500">
          <span>{isCreditNote ? `${labels[0]} Reversed:` : `${labels[0]}:`}</span>
          <span className="font-mono">{sign(invoice.igst ?? 0)}{money(invoice.igst ?? 0)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-slate-500">
            <span>{isCreditNote ? `${labels[0]} Reversed:` : `${labels[0]}:`}</span>
            <span className="font-mono">{sign(invoice.cgst ?? 0)}{money(invoice.cgst ?? 0)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>{isCreditNote ? `${labels[1]} Reversed:` : `${labels[1]}:`}</span>
            <span className="font-mono">{sign(invoice.sgst ?? 0)}{money(invoice.sgst ?? 0)}</span>
          </div>
        </>
      )}
      {!!invoice.roundOff && (
        <div className="flex justify-between text-slate-500">
          <span>Round Off:</span>
          <span className="font-mono">{invoice.roundOff > 0 ? '+' : '-'}₹{Math.abs(invoice.roundOff).toFixed(2)}</span>
        </div>
      )}
    </>
  );
}

export default function BillingEstimator({
  tags,
  setTags,
  customers,
  setCustomers,
  metalRates,
  invoices,
  setInvoices,
  activeBranch,
  taxRates,
  setTaxRates,
  itemDesigns,
  hallmarkPolicy,
  statutoryParameters,
  supervisors,
  currentUserName,
  onApprovalRecorded,
  customerReceipts,
  salespeople,
  incentiveSchemes,
  isOffline,
  onQueueSale
}: BillingEstimatorProps) {
  // Available stock in showroom — only Tags in a legally sellable lifecycle state (Milestone 4)
  const availableStock = tags.filter(i => isSellable(i.status));

  const { theme } = useTheme();
  const { registerWeightField } = useHardware();
  const { notify } = useNotifications();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'create' | 'registry' | 'taxmaster' | 'returns'>('create');

  // Sync tab with URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'history') {
      setActiveTab('registry');
    } else if (params.get('tab') === 'tax') {
      setActiveTab('taxmaster');
    } else if (params.get('tab') === 'returns') {
      setActiveTab('returns');
    }
  }, [window.location.search]);

  // Invoice History Search & Registry
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<SaleInvoice | null>(null);

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Transaction state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Invoice items being billed
  const emptyBillingItem: Partial<InvoiceItem> = {
    name: '', metalType: 'Gold (22K)', netWeight: 0, wastagePercent: 0,
    makingChargeType: 'per-gram', makingChargeValue: 0, makingCharge: 0, stoneCharge: 0, subtotal: 0
  };
  const [billingItems, setBillingItems] = useState<Partial<InvoiceItem>[]>([{ ...emptyBillingItem }]);

  // Scrap / Old Gold trade-in
  const [oldGoldWeight, setOldGoldWeight] = useState<number>(0);
  const [oldGoldPurity, setOldGoldPurity] = useState<string>('22K');
  const [oldGoldRate, setOldGoldRate] = useState<number>(5500); // reduced trade rate

  const [discount, setDiscount] = useState<number>(0);

  /**
   * The supervisor approval covering the CURRENT discount (Milestone 33). Held against the amount
   * it was given for, so raising the discount after approval re-opens the gate rather than riding
   * on a sign-off for a smaller figure.
   */
  /** Who made the sale, as distinct from who is operating the till (Milestone 58). */
  const [salespersonId, setSalespersonId] = useState<string>('');
  const [discountApproval, setDiscountApproval] = useState<ApprovalRecord | null>(null);
  const [isPinModalOpen, setPinModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Scheme Redemption' | 'Credit'>('UPI');

  // PAN / Form 60 capture, mandatory at or above Rs 2,00,000 (Milestone 8, PRD §4.4/§15.3)
  const [panDeclaration, setPanDeclaration] = useState<PanDeclaration | null>(null);
  const [isPanModalOpen, setPanModalOpen] = useState(false);
  const [panInput, setPanInput] = useState('');
  const [panModalError, setPanModalError] = useState('');

  // Multi-tender split (Milestone 9, PRD §7.5). Off by default — the single-mode
  // quick-select above remains the fast path for the common one-payment case.
  const [isSplitPayment, setSplitPayment] = useState(false);
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplitEntry[]>([]);

  // Counter-level price overrides (Milestone 10, PRD §7.1 step 4 / §15.1).
  // Reasons are keyed "<lineIndex>:<field>" so each line's overrides log independently.
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [isOverrideModalOpen, setOverrideModalOpen] = useState(false);

  // Estimate vs. Tax Invoice mode (Milestone 11, PRD §7.8). An estimate is non-fiscal:
  // no tax-invoice number consumed, no stock deducted, statutory gates skipped.
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TAX_INVOICE');
  const isEstimate = invoiceType === 'ESTIMATE';

  // Estimate -> Tax Invoice conversion (from the registry)
  const [estimateToConvert, setEstimateToConvert] = useState<SaleInvoice | null>(null);
  const [convertRateMode, setConvertRateMode] = useState<'ORIGINAL' | 'CURRENT'>('CURRENT');
  const [convertPanInput, setConvertPanInput] = useState('');
  const [convertError, setConvertError] = useState('');

  // Sales Return / Credit Note (Milestone 12, CGST Act §34)
  const [invoiceToReturn, setInvoiceToReturn] = useState<SaleInvoice | null>(null);
  const [returnLineSelection, setReturnLineSelection] = useState<number[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState('');
  const [restockReturnedTags, setRestockReturnedTags] = useState(true);

  // Success screen
  const [completedInvoice, setCompletedInvoice] = useState<SaleInvoice | null>(null);

  // Search catalog helper
  const [selectedStockId, setSelectedStockId] = useState<string>('');

  // Calculate price per gram helper
  const getMetalRate = (metalType: string) => {
    const rate = metalRates.find(r => r.metalType === metalType);
    return rate ? rate.ratePerGram : 0;
  };

  // Recalculate a billing line's Metal/Wastage/Making/Stone breakdown (PRD §7.2)
  const calculateItemSubtotal = (item: Partial<InvoiceItem>) => {
    const rate = getMetalRate(item.metalType || 'Gold (22K)');
    return calculateLineItem({
      netWeight: Number(item.netWeight || 0),
      metalRate: rate,
      wastagePercent: Number(item.wastagePercent || 0),
      makingChargeType: item.makingChargeType === 'flat' ? 'flat' : 'per-gram',
      makingChargeValue: Number(item.makingChargeValue || 0),
      stoneCharge: Number(item.stoneCharge || 0)
    });
  };

  const handleStockSelection = (stockId: string) => {
    if (!stockId) return;
    const stockItem = availableStock.find(i => i.id === stockId);
    if (!stockItem) return;

    // Replace the last empty or new item, or add to list
    const updated = [...billingItems];
    const lastItemIdx = updated.length - 1;

    const billingItem: Partial<InvoiceItem> = {
      itemId: stockItem.id,
      sku: stockItem.sku,
      name: stockItem.name,
      metalType: stockItem.metalType,
      netWeight: stockItem.netWeight,
      wastagePercent: stockItem.wastagePercent,
      makingChargeType: stockItem.makingChargeType,
      makingChargeValue: stockItem.makingChargeValue,
      stoneCharge: stockItem.stoneCharge,
    };

    const calculated = calculateItemSubtotal(billingItem);
    billingItem.goldPrice = calculated.metalValue;
    billingItem.wastageValue = calculated.wastageValue;
    billingItem.makingCharge = calculated.makingCharge;
    billingItem.subtotal = calculated.subtotal;

    if (updated[lastItemIdx]?.name === '' && updated[lastItemIdx]?.netWeight === 0) {
      updated[lastItemIdx] = billingItem;
    } else {
      updated.push(billingItem);
    }

    setBillingItems(updated);
    setSelectedStockId('');
  };

  const updateItemField = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...billingItems];
    updated[index] = { ...updated[index], [field]: value };

    // Trigger recalculation for this item
    const calculated = calculateItemSubtotal(updated[index]);
    updated[index].goldPrice = calculated.metalValue;
    updated[index].wastageValue = calculated.wastageValue;
    updated[index].makingCharge = calculated.makingCharge;
    updated[index].subtotal = calculated.subtotal;

    setBillingItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = billingItems.filter((_, i) => i !== index);
    setBillingItems(updated.length > 0 ? updated : [{ ...emptyBillingItem }]);
  };

  const handleAddItemRow = () => {
    setBillingItems([...billingItems, { ...emptyBillingItem }]);
  };

  // Summary Calculations (PRD §7.3/§7.4/§17 — a bill-level discount reduces the
  // taxable value BEFORE GST is computed (Milestone 7); GST/discount are NEVER
  // reduced by the old-gold trade-in — old gold is netted only against the
  // final payable amount at settlement — KNOWN_ISSUES.md #1)
  const lineSubtotals = billingItems.map(item => item.subtotal || 0);

  // GST rate and split now come from data, not a constant (Milestone 21, PRD §9.2/§7.3).
  const invoiceDate = new Date().toISOString().split('T')[0];

  /** The HSN a billing row is classified under — the design master wins when it has one. */
  const hsnForLine = (item: Partial<InvoiceItem> & { category?: string }): string => {
    const tag = item.itemId ? tags.find(t => t.id === item.itemId) : null;
    const design = tag ? itemDesigns.find(d => d.id === tag.itemDesignId) : null;
    return defaultHsnForLine({
      hsnCode: design?.hsnCode,
      metalType: item.metalType || tag?.metalType,
      category: item.category || tag?.category,
    });
  };

  // The bill's headline rate is the one covering the largest share of the taxable value, so a
  // mixed ornament+bullion bill shows the rate that actually dominates it. Both are 3% today,
  // so this only becomes visible once a genuinely different HSN rate is in play.
  const billHsn = lineSubtotals.length
    ? hsnForLine(billingItems.reduce((a, b) => ((b.subtotal || 0) > (a.subtotal || 0) ? b : a)))
    : defaultHsnForLine({});
  const gstRatePercent = resolveGstRatePercent(billHsn, taxRates, invoiceDate);

  // PRD §7.3: compare the customer's state to the branch's. A walk-in with no state on file
  // is treated as intra-state — the PRD says so explicitly, and treating them as inter-state
  // would misfile every counter sale.
  const supplyType = determineSupplyType(activeBranch?.stateCode, selectedCustomer?.stateCode);

  const {
    subtotal: invoiceSubtotal,
    taxableValue,
    gstTax,
    grandTotal: invoiceTotal,
    gstSplit,
    roundOff,
  } = calculateInvoiceTotals(lineSubtotals, discount, { ratePercent: gstRatePercent, supplyType });

  const taxLineLabels = gstComponentLabels(gstRatePercent, supplyType);

  /**
   * Non-hallmarked sale guard (Milestone 25, PRD §11.3). Computed live so the operator sees the
   * problem while building the bill rather than at the till. Violations are detected regardless
   * of enforcement mode — only the consequence changes.
   */
  const hallmarkViolations = findHallmarkViolations(billingItems, tags, hallmarkPolicy);
  const hallmarkGate = applyHallmarkGate(hallmarkViolations, hallmarkPolicy);
  const oldGoldValue = Math.round(oldGoldWeight * oldGoldRate);
  const netAmountDue = settleOldGold(invoiceTotal, oldGoldValue);
  const finalGrandTotal = netAmountDue; // actual amount collected from the customer, after old-gold settlement

  const splitValidation = validatePaymentSplit(finalGrandTotal, paymentSplit);

  // Any billing line edited away from its Tag's master values is an override needing
  // a logged reason before checkout (Milestone 10, PRD §7.1 step 4 / §15.1).
  const lineOverrides = billingItems.map((item, index) => {
    const master = item.itemId ? tags.find(t => t.id === item.itemId) : null;
    const candidates = detectOverrides(
      { wastagePercent: Number(item.wastagePercent ?? 0), makingChargeValue: Number(item.makingChargeValue ?? 0) },
      master ? { wastagePercent: master.wastagePercent, makingChargeValue: master.makingChargeValue } : null
    );
    return { index, item, candidates };
  }).filter(l => l.candidates.length > 0);

  const overrideReasonKey = (index: number, field: OverrideField) => `${index}:${field}`;

  /**
   * A discount above the configured limit needs a supervisor's PIN (Milestone 33). An approval
   * covers the amount it was given for and anything smaller — raising the discount afterwards
   * re-opens the gate rather than riding on a sign-off for a lesser figure.
   */
  /**
   * Credit exposure check (Milestone 57). A credit sale is the shop lending gold, so the limit is
   * enforced here rather than discovered later in the receivables report. A breach is refused but
   * overridable by a supervisor — the shop can still do it, someone senior just owns the decision.
   */
  const creditTendered = isEstimate
    ? 0
    : isSplitPayment
      ? paymentSplit.filter(e => e.mode === 'Credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      : (paymentMethod === 'Credit' ? finalGrandTotal : 0);

  const creditCheck = creditTendered > 0
    ? checkCreditLimit(selectedCustomer, Math.round(creditTendered * 100), invoices, customerReceipts)
    : null;

  const discountNeedsApproval = requiresSupervisorApproval(discount, statutoryParameters);
  const discountApprovalCovers =
    !!discountApproval && discountApproval.amount >= discount;
  const unapprovedDiscountError = discountNeedsApproval && !discountApprovalCovers
    ? `A discount of ₹${discount.toLocaleString('en-IN')} is above the ₹${statutoryParameters.supervisorApprovalThreshold.toLocaleString('en-IN')} limit and needs a supervisor's approval.`
    : null;

  const unloggedOverrideError = lineOverrides
    .map(l => validateOverrideReasons(
      l.candidates,
      Object.fromEntries(l.candidates.map(c => [c.field, overrideReasons[overrideReasonKey(l.index, c.field)] || ''])) as Partial<Record<OverrideField, string>>
    ))
    .find(err => err !== null) || null;

  const handleToggleSplitPayment = () => {
    if (isSplitPayment) {
      setSplitPayment(false);
      setPaymentSplit([]);
    } else {
      // Seed the split with the currently-selected mode covering the full amount,
      // so staff adjust downward and add a second mode rather than starting from zero.
      setSplitPayment(true);
      setPaymentSplit([{ mode: paymentMethod, amount: finalGrandTotal }]);
    }
    setValidationError(null);
  };

  const addSplitEntry = () => {
    setPaymentSplit(prev => [...prev, { mode: 'Cash', amount: Math.max(0, splitValidation.shortfall) }]);
  };

  const updateSplitEntry = (index: number, patch: Partial<PaymentSplitEntry>) => {
    setPaymentSplit(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  };

  const removeSplitEntry = (index: number) => {
    setPaymentSplit(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = () => {
    setValidationError(null);

    // Filter out rows that are completely empty
    const filledItems = billingItems.filter(item => {
      const hasName = !!item.name?.trim();
      const hasWeight = Number(item.netWeight || 0) > 0;
      return hasName || hasWeight;
    });

    if (filledItems.length === 0) {
      setValidationError("Please add at least one item with a valid name or weight.");
      return;
    }

    // Non-hallmarked sale guard (Milestone 25, PRD §11.3). Checked BEFORE the PAN/tender gates:
    // if a piece legally cannot be sold at all, there is no point collecting a PAN or a payment
    // for it. An ESTIMATE is a quotation, not a supply, so it is quoted freely — the guard
    // re-applies when that estimate is converted into a real tax invoice.
    if (!isEstimate && hallmarkGate.blocked) {
      setValidationError(hallmarkGate.message);
      return;
    }

    // PAN / Form 60 is mandatory at or above Rs 2,00,000 (PRD §4.4/§15.3, Rule 114B).
    // The threshold applies to the tax invoice value, not the post-old-gold cash collected.
    // Estimates are non-fiscal quotations and skip this gate — it re-applies on conversion.
    if (!isEstimate && isPanRequiredFor(invoiceTotal, statutoryParameters)) {
      const panError = validatePanDeclaration(invoiceTotal, panDeclaration);
      if (panError) {
        setPanModalOpen(true);
        setValidationError(panError);
        return;
      }
    }

    // Every price override must carry a logged manager reason (PRD §7.1 step 4/§15.1, Milestone 10)
    if (unloggedOverrideError) {
      setOverrideModalOpen(true);
      setValidationError(unloggedOverrideError);
      return;
    }

    // A large discount needs a second pair of eyes (Milestone 33). Applies to an estimate too:
    // a quotation carrying an unapproved discount is what the customer will hold the shop to.
    if (unapprovedDiscountError) {
      setPinModalOpen(true);
      setValidationError(unapprovedDiscountError);
      return;
    }

    // A multi-tender split must sum exactly to the amount due before checkout (PRD §7.5, Milestone 9).
    // Nothing is tendered against an estimate, so there is no split to validate.
    if (!isEstimate && isSplitPayment && !splitValidation.isValid) {
      setValidationError(splitValidation.error || 'The payment split does not settle the amount due.');
      return;
    }

    // Scheme Redemption must validate against and deduct from the customer's actual savings
    // balance — previously a purely cosmetic label (KNOWN_ISSUES.md #5). With a split, only
    // the portion actually tendered against the scheme is validated and debited. An estimate
    // collects nothing, so it must never touch the customer's scheme balance.
    const schemeRedeemedAmount = isEstimate
      ? 0
      : isSplitPayment
        ? paymentSplit.filter(e => e.mode === 'Scheme Redemption').reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        : (paymentMethod === 'Scheme Redemption' ? finalGrandTotal : 0);

    if (schemeRedeemedAmount > 0) {
      if (!selectedCustomer || !selectedCustomer.savingsSchemeActive) {
        setValidationError("Scheme Redemption requires a CRM customer with an active Gold Savings Scheme.");
        return;
      }
      if (schemeRedeemedAmount > (selectedCustomer.savingsSchemeBalance || 0)) {
        setValidationError(`Scheme balance (₹${(selectedCustomer.savingsSchemeBalance || 0).toLocaleString('en-IN')}) is insufficient to cover the redeemed amount (₹${schemeRedeemedAmount.toLocaleString('en-IN')}).`);
        return;
      }
    }

    // A credit sale beyond the customer's limit is refused here, not discovered in the ageing
    // report six weeks later when the money is already gone.
    if (creditCheck && !creditCheck.allowed) {
      setValidationError(creditCheck.message);
      return;
    }

    const customerName = selectedCustomer ? selectedCustomer.name : guestName.trim() || 'Guest Walk-in';
    const customerPhone = selectedCustomer ? selectedCustomer.phone : guestPhone.trim() || 'N/A';

    const processedItems = filledItems.map(item => {
      const name = item.name?.trim() || `${item.metalType || 'Gold'} Showroom Ornament`;
      // Carry any logged overrides onto the saved invoice line for later audit (Milestone 10)
      const originalIndex = billingItems.indexOf(item);
      const lineOverride = lineOverrides.find(l => l.index === originalIndex);
      const overrides = lineOverride
        ? buildOverrideRecords(
            lineOverride.candidates,
            Object.fromEntries(lineOverride.candidates.map(c => [c.field, overrideReasons[overrideReasonKey(originalIndex, c.field)] || ''])) as Partial<Record<OverrideField, string>>
          )
        : undefined;

      return {
        itemId: item.itemId,
        sku: item.sku,
        name,
        metalType: item.metalType || 'Gold (22K)',
        netWeight: Number(item.netWeight || 0),
        wastagePercent: Number(item.wastagePercent || 0),
        makingChargeType: (item.makingChargeType === 'flat' ? 'flat' : 'per-gram') as 'flat' | 'per-gram',
        makingChargeValue: Number(item.makingChargeValue || 0),
        goldPrice: Number(item.goldPrice || 0),
        wastageValue: Number(item.wastageValue || 0),
        makingCharge: Number(item.makingCharge || 0),
        stoneCharge: Number(item.stoneCharge || 0),
        subtotal: Number(item.subtotal || 0),
        overrides,
        // Rule 46 requires an HSN per line, and GSTR-1 summarises by it (Milestone 21).
        // Captured at billing time so a reprint shows what was actually charged.
        hsnCode: hsnForLine(item),
        gstRatePercent: resolveGstRatePercent(hsnForLine(item), taxRates, invoiceDate),
        // The HUID printed against this line (PRD §9.3). A catalogue line takes the tag's;
        // a custom line carries whatever was recorded against it (Milestone 25).
        huid: (item.itemId ? tags.find(t => t.id === item.itemId)?.huid : item.huid) || undefined
      };
    });

    const invoice: SaleInvoice = {
      id: `${isEstimate ? 'est' : 'inv'}-${Date.now()}`,
      invoiceType,
      // An estimate draws from its own sequence and never consumes a GST tax-invoice number (Rule 46)
      invoiceNumber: isEstimate ? nextEstimateNumber() : nextBranchInvoiceNumber(activeBranch),
      date: new Date().toISOString().split('T')[0],
      customerId: selectedCustomer?.id,
      customerName,
      customerPhone,
      items: processedItems,
      oldGoldWeight,
      oldGoldValue,
      subtotal: invoiceSubtotal,
      tax: gstTax,
      discount,
      grandTotal: invoiceTotal,
      netAmountDue: finalGrandTotal,
      branchId: activeBranch?.id,
      // Statutory tax breakdown (Milestone 21). cgst + sgst + igst always equals `tax`.
      cgst: gstSplit.cgst,
      sgst: gstSplit.sgst,
      igst: gstSplit.igst,
      supplyType,
      placeOfSupplyStateCode: selectedCustomer?.stateCode || activeBranch?.stateCode,
      roundOff,
      paymentMethod: isSplitPayment && paymentSplit.length > 1 ? 'Mixed' : (isSplitPayment ? paymentSplit[0]?.mode || paymentMethod : paymentMethod),
      // An estimate records no tender and no PAN — both belong to the eventual tax invoice
      paymentSplit: isEstimate ? undefined : (isSplitPayment ? paymentSplit : [{ mode: paymentMethod, amount: finalGrandTotal }]),
      panDeclaration: isEstimate ? undefined : (panDeclaration || undefined),
      // The sign-off travels with the bill, so a reprint shows who authorised the discount.
      approvals: discountApprovalCovers && discountApproval ? [discountApproval] : undefined,
      // Frozen at sale time (Milestone 58): a later scheme change must not restate this payout.
      salesAttribution: undefined as SaleInvoice['salesAttribution']
    };

    const seller = salespeople.find(p => p.id === salespersonId);
    const scheme = schemeInForce(incentiveSchemes, invoice.date);
    if (seller && scheme && !isEstimate) {
      invoice.salesAttribution = buildAttribution(invoice, seller, scheme);
    }

    // Offline, a tax invoice goes to the queue instead of the register (Milestone 36). It has no
    // confirmed place in the series yet — another terminal may have taken the number — so writing
    // it straight into the register would assert a sequence this terminal cannot vouch for. An
    // estimate is non-fiscal and consumes no series, so it registers normally either way.
    if (isOffline && !isEstimate) {
      onQueueSale(invoice);
    } else {
      setInvoices(prev => [invoice, ...prev]);
      // Estimates raise nothing: a quotation is not an event the shop needs told about.
      if (!isEstimate) notify(NOTIFY.saleCompleted(invoice.invoiceNumber, invoice.grandTotal));
    }

    // Mark catalogue tags in stock as "Sold" — only ever via a legal state-machine transition
    // (Milestone 4, Handbook D-7). An estimate reserves nothing and must not deduct stock.
    const soldTagIds = isEstimate ? [] : processedItems.map(i => i.itemId).filter(id => id !== undefined) as string[];
    if (soldTagIds.length > 0) {
      setTags(prev => prev.map(tag => {
        if (soldTagIds.includes(tag.id) && canTransition(tag.status, 'Sold')) {
          return { ...tag, status: 'Sold' };
        }
        return tag;
      }));
    }

    // Deduct only the portion actually tendered against the scheme (single-mode or split)
    if (schemeRedeemedAmount > 0 && selectedCustomer) {
      setCustomers(prev => prev.map(c =>
        c.id === selectedCustomer.id
          ? { ...c, savingsSchemeBalance: (c.savingsSchemeBalance || 0) - schemeRedeemedAmount }
          : c
      ));
    }

    // Set completed invoice for receipt presentation
    setCompletedInvoice(invoice);
  };

  const handleResetBilling = () => {
    setBillingItems([{ ...emptyBillingItem }]);
    setSelectedCustomer(null);
    setGuestName('');
    setGuestPhone('');
    setOldGoldWeight(0);
    setDiscount(0);
    setDiscountApproval(null);
    setSalespersonId('');
    setCompletedInvoice(null);
    setValidationError(null);
    setPanDeclaration(null);
    setPanInput('');
    setPanModalError('');
    setSplitPayment(false);
    setPaymentSplit([]);
    setOverrideReasons({});
  };

  /**
   * Converts an ESTIMATE into a real TAX_INVOICE (Milestone 11, PRD §7.8). Staff explicitly
   * choose whether to honor the rate quoted on the estimate or re-price at today's rate —
   * gold moves daily, so silently picking either would be wrong. Statutory gates skipped at
   * estimate time (PAN) re-apply here, since this is the point a fiscal document is created.
   */
  const handleConvertEstimate = () => {
    const estimate = estimateToConvert;
    if (!estimate) return;
    setConvertError('');

    let items = estimate.items;

    if (convertRateMode === 'CURRENT') {
      // Re-price every line against today's metal rate, reusing the shared calculation
      // engine rather than re-deriving the formula (Handbook D-9).
      items = estimate.items.map(item => {
        const rate = metalRates.find(r => r.metalType === item.metalType)?.ratePerGram || 0;
        const recalculated = calculateLineItem({
          netWeight: item.netWeight,
          metalRate: rate,
          wastagePercent: item.wastagePercent,
          makingChargeType: item.makingChargeType,
          makingChargeValue: item.makingChargeValue,
          stoneCharge: item.stoneCharge
        });
        return {
          ...item,
          goldPrice: recalculated.metalValue,
          wastageValue: recalculated.wastageValue,
          makingCharge: recalculated.makingCharge,
          subtotal: recalculated.subtotal
        };
      });
    }

    const totals = calculateInvoiceTotals(items.map(i => i.subtotal), estimate.discount);
    const convertedNetDue = settleOldGold(totals.grandTotal, estimate.oldGoldValue);

    // PAN / Form 60 gate applies to the converted tax invoice's value (Rule 114B)
    let declaration: PanDeclaration | undefined = estimate.panDeclaration;
    if (isPanRequiredFor(totals.grandTotal, statutoryParameters)) {
      const typed = convertPanInput.trim().toUpperCase();
      if (!declaration || (declaration.type === 'PAN' && declaration.panNumber !== typed)) {
        declaration = typed === 'FORM60'
          ? { type: 'FORM_60' }
          : { type: 'PAN', panNumber: typed };
      }
      const panError = validatePanDeclaration(totals.grandTotal, declaration);
      if (panError) {
        setConvertError(`${panError} (Type FORM60 to record a Form 60 declaration instead.)`);
        return;
      }
    }

    const taxInvoice: SaleInvoice = {
      ...estimate,
      id: `inv-${Date.now()}`,
      invoiceType: 'TAX_INVOICE',
      invoiceNumber: nextBranchInvoiceNumber(activeBranch),
      date: new Date().toISOString().split('T')[0],
      items,
      subtotal: totals.subtotal,
      tax: totals.gstTax,
      grandTotal: totals.grandTotal,
      netAmountDue: convertedNetDue,
      paymentSplit: [{ mode: estimate.paymentMethod === 'Mixed' ? 'Cash' : estimate.paymentMethod, amount: convertedNetDue }],
      panDeclaration: declaration,
      convertedFromEstimateNumber: estimate.invoiceNumber,
      convertedToInvoiceNumber: undefined
    };

    setInvoices(prev => [
      taxInvoice,
      // Stamp the source estimate so it can never be silently converted twice
      ...prev.map(inv => inv.id === estimate.id
        ? { ...inv, convertedToInvoiceNumber: taxInvoice.invoiceNumber }
        : inv)
    ]);

    // Only now does stock actually move (Milestone 4 / Handbook D-7)
    const soldTagIds = items.map(i => i.itemId).filter(id => id !== undefined) as string[];
    if (soldTagIds.length > 0) {
      setTags(prev => prev.map(tag =>
        soldTagIds.includes(tag.id) && canTransition(tag.status, 'Sold')
          ? { ...tag, status: 'Sold' }
          : tag
      ));
    }

    setEstimateToConvert(null);
    setConvertPanInput('');
    setSelectedInvoiceForDetail(taxInvoice);
  };

  /**
   * Raises a credit note against a prior tax invoice (Milestone 12, CGST Act §34). Supports
   * partial returns: only the selected lines are reversed, and any bill-level discount is
   * clawed back proportionally (see salesReturn.ts). The returned Tags move Sold -> Returned,
   * which quarantines them for QC rather than putting them straight back on the shelf.
   */
  const handleCreateCreditNote = () => {
    const original = invoiceToReturn;
    if (!original) return;

    const alreadyReturned = original.returnedLineIndexesCovered || [];
    const selectionError = validateReturnSelection(returnLineSelection, alreadyReturned);
    if (selectionError) {
      setReturnError(selectionError);
      return;
    }
    if (returnReason.trim().length < 5) {
      setReturnError('Record a reason for the return (min. 5 characters) — it is part of the audit trail.');
      return;
    }

    const totals = calculateReturnTotals(
      original.items,
      returnLineSelection,
      original.subtotal,
      original.discount,
      // Earlier credit notes against this invoice, so the discount shares telescope and a
      // fully-returned invoice reverses its discount exactly rather than a rupee short.
      original.returnedLineIndexesCovered || []
    );

    const returnedItems = returnLineSelection.map(i => original.items[i]);
    const creditNoteNumber = nextCreditNoteNumber();

    const creditNote: SaleInvoice = {
      id: `crn-${Date.now()}`,
      invoiceType: 'CREDIT_NOTE',
      invoiceNumber: creditNoteNumber,
      date: new Date().toISOString().split('T')[0],
      customerId: original.customerId,
      customerName: original.customerName,
      customerPhone: original.customerPhone,
      items: returnedItems,
      // Old gold was a separate purchase transaction (PRD §8.3 / D-10) and is not unwound by
      // a sales return — the shop already took the metal in and paid for it.
      oldGoldWeight: 0,
      oldGoldValue: 0,
      subtotal: totals.returnedSubtotal,
      tax: totals.returnedTax,
      discount: totals.discountReversed,
      grandTotal: totals.returnedTotal,
      netAmountDue: totals.returnedTotal, // negative = refundable to the customer
      paymentMethod: original.paymentMethod,
      paymentSplit: undefined,
      branchId: activeBranch?.id,
      creditNoteAgainstInvoice: original.invoiceNumber,
      creditNoteAgainstInvoiceDate: original.date,
      returnedLineIndexes: [...returnLineSelection],
      returnReason: returnReason.trim()
    };

    setInvoices(prev => [
      creditNote,
      ...prev.map(inv => inv.id === original.id
        ? {
            ...inv,
            creditNoteNumbers: [...(inv.creditNoteNumbers || []), creditNoteNumber],
            returnedLineIndexesCovered: [...alreadyReturned, ...returnLineSelection]
          }
        : inv)
    ]);

    // Physical pieces come back. Sold -> Returned is the only legal way out of Sold, and it
    // exists precisely so stock can never be un-sold without a credit note (Milestone 4/12).
    const returnedTagIds = returnedItems.map(i => i.itemId).filter(Boolean) as string[];
    if (returnedTagIds.length > 0) {
      setTags(prev => prev.map(tag => {
        if (!returnedTagIds.includes(tag.id)) return tag;
        if (!canTransition(tag.status, 'Returned')) return tag;
        const returned: Tag = { ...tag, status: 'Returned' };
        // Optional immediate QC pass straight back into sellable stock
        if (restockReturnedTags && canTransition(returned.status, 'InStock')) {
          return { ...returned, status: 'InStock' };
        }
        return returned;
      }));
    }

    // Refunding against a scheme redemption credits the balance back
    if (original.paymentMethod === 'Scheme Redemption' && original.customerId) {
      const refund = Math.abs(totals.returnedTotal);
      setCustomers(prev => prev.map(c =>
        c.id === original.customerId
          ? { ...c, savingsSchemeBalance: (c.savingsSchemeBalance || 0) + refund }
          : c
      ));
    }

    setInvoiceToReturn(null);
    setReturnLineSelection([]);
    setReturnReason('');
    setReturnError('');
    setSelectedInvoiceForDetail(creditNote);
  };

  /* ─── e-Invoice simulation (Milestone 22, PRD §9.4) ─── */
  const [eInvoiceToCancel, setEInvoiceToCancel] = useState<SaleInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const handleSubmitEInvoice = (inv: SaleInvoice, forceFailure: boolean) => {
    const gstin = activeBranch?.gstin || '27AACCS9948H1Z1';
    const record = submitForIrn(inv, gstin, inv.eInvoice, { forceFailure });
    setInvoices(prev => prev.map(i => (i.id === inv.id ? { ...i, eInvoice: record } : i)));
    setSelectedInvoiceForDetail(prev => (prev && prev.id === inv.id ? { ...prev, eInvoice: record } : prev));
  };

  const handleCancelEInvoice = () => {
    if (!eInvoiceToCancel?.eInvoice) return;
    const { record, error } = cancelEInvoice(eInvoiceToCancel.eInvoice, cancelReason);
    if (error) {
      setCancelError(error);
      return;
    }
    setInvoices(prev => prev.map(i => (i.id === eInvoiceToCancel.id ? { ...i, eInvoice: record } : i)));
    setSelectedInvoiceForDetail(prev =>
      prev && prev.id === eInvoiceToCancel.id ? { ...prev, eInvoice: record } : prev
    );
    setEInvoiceToCancel(null);
    setCancelReason('');
    setCancelError('');
  };

  const handleConfirmPan = (type: PanDeclaration['type']) => {
    if (type === 'FORM_60') {
      setPanDeclaration({ type: 'FORM_60' });
      setPanModalError('');
      setPanModalOpen(false);
      setValidationError(null);
      return;
    }
    if (!isValidPanFormat(panInput)) {
      setPanModalError('Enter a valid PAN in the format ABCDE1234F.');
      return;
    }
    setPanDeclaration({ type: 'PAN', panNumber: panInput.trim().toUpperCase() });
    setPanModalError('');
    setPanModalOpen(false);
    setValidationError(null);
  };

  // Statistics for Registry
  // Registry KPIs count only real fiscal documents — an estimate is a quotation, not a sale,
  // and must never inflate revenue, old-gold intake, or billed-customer counts (Milestone 11).
  // Credit notes carry negative figures, so summing them alongside invoices yields NET sales
  // after returns without any special-casing (Milestone 12).
  const taxInvoices = invoices.filter(inv => inv.invoiceType === 'TAX_INVOICE');
  const creditNotes = invoices.filter(inv => inv.invoiceType === 'CREDIT_NOTE');
  const estimatesCount = invoices.filter(inv => inv.invoiceType === 'ESTIMATE').length;
  const totalInvoicesCount = taxInvoices.length;
  const totalInvoicesValue = [...taxInvoices, ...creditNotes].reduce((sum, inv) => sum + inv.grandTotal, 0);
  const totalOldGoldWeight = taxInvoices.reduce((sum, inv) => sum + inv.oldGoldWeight, 0);
  const uniqueCustomersCount = new Set(taxInvoices.map(inv => inv.customerName)).size;
  const totalReturnedValue = creditNotes.reduce((sum, inv) => sum + Math.abs(inv.grandTotal), 0);

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.customerPhone.toLowerCase().includes(q) ||
      inv.items.some(item => item.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Tab Bar (Hidden in print mode) */}
      {!completedInvoice && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px gap-6 items-center print:hidden">
          <button
            onClick={() => {
              setActiveTab('create');
              window.history.replaceState({}, '', '/billing');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'create'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            POS Invoice Desk
            {activeTab === 'create' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('registry');
              window.history.replaceState({}, '', '/billing?tab=history');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'registry'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Sales Invoices Registry
            {activeTab === 'registry' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('taxmaster');
              window.history.replaceState({}, '', '/billing?tab=tax');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'taxmaster'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Tax Master (HSN)
            {activeTab === 'taxmaster' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('returns');
              window.history.replaceState({}, '', '/billing?tab=returns');
            }}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === 'returns'
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            GST Returns
            {activeTab === 'returns' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
            )}
          </button>
        </div>
      )}

      {completedInvoice ? (
        /* PRINTABLE INVOICE RECEIPT SCREEN */
        <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-lg max-w-2xl mx-auto space-y-6 relative text-slate-800">
          <div className="absolute top-6 right-6 flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print {completedInvoice.invoiceType === 'ESTIMATE' ? 'Estimate' : completedInvoice.invoiceType === 'CREDIT_NOTE' ? 'Credit Note' : 'Invoice'}
            </button>
            <button
              onClick={handleResetBilling}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition cursor-pointer"
            >
              New Bill
            </button>
            <button
              onClick={() => {
                handleResetBilling();
                setActiveTab('registry');
                window.history.replaceState({}, '', '/billing?tab=history');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
            >
              View Registry
            </button>
          </div>

          {/* Core Printable Tax Invoice */}
          <div className="space-y-6 pt-6 print:pt-0" id="print-area">
            {/* Header */}
            <div className="text-center border-b pb-4 space-y-1">
              <h1 className="font-sans font-black text-2xl tracking-wider text-slate-900">STITCH JEWELLERY HOUSE</h1>
              {/* Rule 46: the issuing branch's own address and GSTIN, not a hardcoded HQ one */}
              <p className="text-xs text-slate-500">{activeBranch?.address || '102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002'}</p>
              <p className="text-[10px] font-mono text-slate-400">Tel: +91 22 2240 8710 | GSTIN: {activeBranch?.gstin || '27AACCS9948H1Z1'}</p>
              {/* A quotation must be unmistakably marked as non-fiscal (PRD §7.8, Milestone 11) */}
              <h2 className={`text-xs uppercase font-bold py-1 tracking-widest rounded mt-3 ${
                completedInvoice.invoiceType === 'ESTIMATE'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {completedInvoice.invoiceType === 'ESTIMATE' ? 'ESTIMATE — NOT A TAX INVOICE' : 'TAX INVOICE'}
              </h2>
            </div>

            {/* Info details */}
            <div className="grid grid-cols-2 text-xs font-medium text-slate-600 gap-y-2">
              <div>
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">
                  {completedInvoice.invoiceType === 'ESTIMATE' ? 'Estimate Number:' : 'Invoice Number:'}
                </span></p>
                <p className="font-mono font-bold text-slate-900 text-sm">{completedInvoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Date:</span></p>
                <p className="font-mono text-slate-900">{completedInvoice.date}</p>
              </div>
              <div>
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Billed To:</span></p>
                <p className="font-bold text-slate-900">{completedInvoice.customerName}</p>
                <p className="font-mono text-slate-500">{completedInvoice.customerPhone}</p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Cashier / Operator:</span></p>
                <p className="font-bold text-slate-900">Prathamesh S.</p>
                <p className="font-mono text-slate-500">Counter Terminal #1</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border-t border-b py-2">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="text-slate-400 uppercase font-mono text-[9px] border-b pb-2">
                    <th className="py-2">Item Description</th>
                    <th>Standard</th>
                    {/* Rule 46 requires the HSN code printed against every line */}
                    <th>HSN</th>
                    <th className="text-right">Net Wt</th>
                    <th className="text-right">Metal Rate</th>
                    <th className="text-right">Wastage + MC + Stones</th>
                    <th className="text-right py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-800">
                  {completedInvoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3">
                        <p className="font-bold text-slate-900">{item.name}</p>
                        {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                      </td>
                      <td className="font-mono text-slate-500">
                        {item.metalType}
                        {/* PRD §9.3: the HUID must appear against each hallmarked piece */}
                        {item.huid && <span className="block text-[9px] text-slate-400">HUID: {item.huid}</span>}
                      </td>
                      <td className="font-mono text-slate-500">{item.hsnCode || '7113'}</td>
                      <td className="text-right font-mono">{item.netWeight.toFixed(2)} g</td>
                      <td className="text-right font-mono">₹{item.goldPrice ? Math.round(item.goldPrice / item.netWeight).toLocaleString('en-IN') : '-'}</td>
                      <td className="text-right font-mono">₹{(item.wastageValue + item.makingCharge + item.stoneCharge).toLocaleString('en-IN')}</td>
                      <td className="text-right font-mono font-bold text-slate-900 py-3">₹{item.subtotal.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price Calculations breakdown */}
            <div className="w-1/2 ml-auto text-xs font-medium space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">₹{completedInvoice.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {completedInvoice.discount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount Code Applied:</span>
                  <span className="font-mono">-₹{completedInvoice.discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <InvoiceTaxLines invoice={completedInvoice} />
              <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                <span>{completedInvoice.invoiceType === 'ESTIMATE' ? 'Estimate Total (Indicative):' : 'Invoice Total (Tax Invoice):'}</span>
                <span className="font-mono text-amber-800">₹{completedInvoice.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              {completedInvoice.oldGoldWeight > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">
                  <span>Less: Old Gold Buyback ({completedInvoice.oldGoldWeight}g, settlement only):</span>
                  <span className="font-mono">-₹{completedInvoice.oldGoldValue.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                <span>{completedInvoice.invoiceType === 'ESTIMATE' ? 'Estimated Payable:' : 'Net Amount Due:'}</span>
                <span className="font-mono text-amber-800">₹{completedInvoice.netAmountDue.toLocaleString('en-IN')}</span>
              </div>
              {completedInvoice.invoiceType === 'ESTIMATE' && (
                <p className="text-[10px] text-amber-700 pt-1 leading-snug">
                  Indicative only, subject to the prevailing metal rate on the date of purchase. Not valid for GST input credit.
                </p>
              )}

              {/* Multi-tender breakdown (PRD §7.5) */}
              {completedInvoice.paymentSplit && completedInvoice.paymentSplit.length > 0 && (
                <div className="pt-2 mt-1 border-t border-dashed border-slate-200 space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Settled Via</p>
                  {completedInvoice.paymentSplit.map((entry, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500">
                      <span>{entry.mode}</span>
                      <span className="font-mono">₹{entry.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logged price overrides — audit trail (PRD §15.1, Milestone 10) */}
            {completedInvoice.items.some(i => i.overrides && i.overrides.length > 0) && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-[10px] text-amber-900 space-y-1.5">
                <p className="font-bold uppercase tracking-wider font-mono">Approved Price Overrides</p>
                {completedInvoice.items.flatMap((item, i) =>
                  (item.overrides || []).map((o, j) => (
                    <p key={`${i}-${j}`}>
                      <span className="font-bold">{item.name}</span> — {OVERRIDE_FIELD_LABEL[o.field]}: {o.originalValue} → {o.newValue} · <span className="italic">{o.reason}</span>
                    </p>
                  ))
                )}
              </div>
            )}

            {/* Hallmark Warranty declaration — a certification belongs only on a real tax
                invoice; asserting it on a non-fiscal quotation would be a false declaration. */}
            {completedInvoice.invoiceType === 'TAX_INVOICE' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-500 space-y-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <FileCheck className="w-4 h-4 text-amber-600" /> BIS Hallmark & Quality Warranty
                </p>
                <p>Certified that all gold items listed are BIS Hallmarked with HUID values. Diamonds are verified with IGI/GIA certifications. Returns/Buybacks are accepted on prevailing market rates subject to standard melting purity tests.</p>
              </div>
            )}

            {/* Signature fields */}
            <div className="grid grid-cols-2 pt-10 text-center text-[10px] font-semibold text-slate-400">
              <div>
                <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Customer Signature</p>
              </div>
              <div>
                <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'create' ? (
        /* STANDARD CALCULATION SHEET */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer & Item list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Attachment Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <User className="w-5 h-5 text-amber-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">Customer Attachment</h3>
              </div>

              {/* CRM selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Select CRM Customer</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const cust = customers.find(c => c.id === e.target.value);
                      setSelectedCustomer(cust || null);
                    }}
                  >
                    <option value="">-- Walk-in Guest (Enter manually below) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - {c.tier} Tier
                      </option>
                    ))}
                  </select>
                </div>

                {/* If guest manual entry */}
                {!selectedCustomer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Guest Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Guest Phone</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Place of supply decides CGST+SGST vs IGST (Milestone 21, PRD §7.3). Shown
                    explicitly so the biller can see WHY a bill turned inter-state. */}
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  supplyType === 'INTER_STATE'
                    ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40'
                    : 'bg-slate-50/60 border-slate-150 dark:bg-zinc-900/40 dark:border-zinc-800'
                }`}>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Place of Supply</span>
                    <p className="font-bold text-slate-700 dark:text-zinc-200">
                      State {selectedCustomer?.stateCode || activeBranch?.stateCode || '—'}
                      {!selectedCustomer?.stateCode && (
                        <span className="font-normal text-slate-400"> · defaulted to branch state</span>
                      )}
                    </p>
                    {selectedCustomer?.gstin && (
                      <p className="text-[10px] font-mono text-slate-400">Customer GSTIN: {selectedCustomer.gstin}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    supplyType === 'INTER_STATE'
                      ? 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  }`}>
                    {supplyType === 'INTER_STATE' ? 'IGST' : 'CGST + SGST'}
                  </span>
                </div>

                {selectedCustomer && (
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Loyalty Wallet</span>
                      <p className="font-bold text-amber-800">{selectedCustomer.loyaltyPoints} points available</p>
                    </div>
                    {selectedCustomer.savingsSchemeActive && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gold Scheme Balance</span>
                        <p className="font-bold text-emerald-800">₹{selectedCustomer.savingsSchemeBalance?.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Billing Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-600" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm">Ornaments to Invoice</h3>
                </div>

                {/* Showroom Stock Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Pull Stock:</span>
                  <select
                    className="text-xs px-3 py-1.5 border border-slate-200 bg-amber-50 text-amber-900 font-semibold rounded-lg focus:outline-none focus:border-amber-500 max-w-[200px]"
                    value={selectedStockId}
                    onChange={(e) => handleStockSelection(e.target.value)}
                  >
                    <option value="">-- Choose Showroom Item --</option>
                    {availableStock.map(item => (
                      <option key={item.id} value={item.id}>
                        [{item.sku}] {item.name} ({item.netWeight}g)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List Rows */}
              <div className="space-y-4">
                {billingItems.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 space-y-3 relative group/row">
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover/row:opacity-100 transition"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Top Row: Description */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ornament Description</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Handmade Filigree Ring"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.name}
                          onChange={(e) => updateItemField(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metal Standard</label>
                        <select
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-md focus:outline-none focus:border-amber-500"
                          value={item.metalType}
                          onChange={(e) => updateItemField(index, 'metalType', e.target.value as any)}
                        >
                          <option value="Gold (24K)">Gold (24K)</option>
                          <option value="Gold (22K)">Gold (22K)</option>
                          <option value="Gold (18K)">Gold (18K)</option>
                          <option value="Silver (999)">Silver (999)</option>
                          <option value="Platinum (950)">Platinum (950)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Net Weight (g)</label>
                        <input
                          type="number"
                          step="0.001"
                          required
                          placeholder="0.00"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.netWeight || ''}
                          onChange={(e) => updateItemField(index, 'netWeight', parseFloat(e.target.value) || 0)}
                          onFocus={() => registerWeightField(
                            `Billing line ${index + 1} — net weight`,
                            (grams) => updateItemField(index, 'netWeight', grams)
                          )}
                        />
                      </div>
                    </div>

                    {/* Middle Row: Wastage & Making Charge inputs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Wastage %</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.wastagePercent || ''}
                          onChange={(e) => updateItemField(index, 'wastagePercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Making Charge Type</label>
                        <select
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 bg-white rounded-md focus:outline-none focus:border-amber-500"
                          value={item.makingChargeType || 'per-gram'}
                          onChange={(e) => updateItemField(index, 'makingChargeType', e.target.value as any)}
                        >
                          <option value="per-gram">Per Gram</option>
                          <option value="flat">Flat / Piece</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Making Charge {item.makingChargeType === 'flat' ? '(Flat ₹)' : '(₹/g)'}
                        </label>
                        <input
                          type="number"
                          placeholder="₹400"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.makingChargeValue || ''}
                          onChange={(e) => updateItemField(index, 'makingChargeValue', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stones Charge (₹)</label>
                        <input
                          type="number"
                          placeholder="₹0"
                          className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white"
                          value={item.stoneCharge || ''}
                          onChange={(e) => updateItemField(index, 'stoneCharge', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* HUID. A catalogue line shows the Tag's, read-only — it is assigned by the AHC
                        (Milestone 24) and must never be editable at the till. A custom line has no
                        tag, so it records its own; without this the sale guard could be bypassed
                        simply by typing the piece in rather than scanning it (Milestone 25). */}
                    {(() => {
                      const lineTag = item.itemId ? tags.find(t => t.id === item.itemId) : null;
                      const offending = hallmarkViolations.some(v => v.lineIndex === index);
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              BIS HUID {lineTag ? '(from tag)' : '(custom line)'}
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              readOnly={!!lineTag}
                              placeholder={lineTag ? 'Not hallmarked' : 'A1B2C3'}
                              className={`w-full text-xs font-mono uppercase px-2.5 py-1.5 border rounded-md focus:outline-none focus:border-amber-500 ${
                                lineTag
                                  ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed'
                                  : offending
                                    ? 'bg-white border-rose-400'
                                    : 'bg-white border-slate-200'
                              }`}
                              value={(lineTag ? lineTag.huid : item.huid) || ''}
                              onChange={(e) => updateItemField(index, 'huid', e.target.value.toUpperCase())}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bottom Row: Computed breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Metal Value</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.goldPrice || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Wastage Value</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.wastageValue || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Making Charge</span>
                        <span className="font-mono text-xs font-bold text-amber-800">
                          ₹{(item.makingCharge || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="bg-amber-100/50 p-2.5 rounded-md flex flex-col justify-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Line Item Value</span>
                        <span className="font-mono text-xs font-black text-slate-900">
                          ₹{(item.subtotal || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add row triggers */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/80 px-4 py-2.5 rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Add Custom Item Row
                </button>
              </div>
            </div>

            {/* Scrap Gold Buyback / Exchange Section */}
            <div className="bg-white border border-slate-150 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Coins className="w-5 h-5 text-amber-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm">Old Gold Trade-in Buyback (Deduction Credit)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Old Weight (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={oldGoldWeight || ''}
                    onChange={(e) => setOldGoldWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Stated Purity</label>
                  <select
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white"
                    value={oldGoldPurity}
                    onChange={(e) => {
                      setOldGoldPurity(e.target.value);
                      if (e.target.value === '22K') setOldGoldRate(5500);
                      else if (e.target.value === '24K') setOldGoldRate(6200);
                      else setOldGoldRate(4200);
                    }}
                  >
                    <option value="24K">Old Gold (24K) - Melt valuation</option>
                    <option value="22K">Old Gold (22K) - 916 Scrap</option>
                    <option value="18K">Old Gold (18K) - Standard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400 mb-1.5">Trade valuation / g (₹)</label>
                  <input
                    type="number"
                    placeholder="₹5500"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={oldGoldRate || ''}
                    onChange={(e) => setOldGoldRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {oldGoldWeight > 0 && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-150 flex justify-between items-center text-xs">
                  <span className="font-medium text-emerald-800">Total Trade-in credit value:</span>
                  <span className="font-mono font-black text-emerald-800">-₹{oldGoldValue.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Invoice calculations */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm space-y-5 sticky top-6">
              <div className="pb-3 border-b border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-slate-800" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm">
                    {isEstimate ? 'Estimate Calculation Sheet' : 'Invoice Calculation Sheet'}
                  </h3>
                </div>

                {/* Document type: non-fiscal Estimate vs. real Tax Invoice (Milestone 11, PRD §7.8) */}
                <div className="grid grid-cols-2 gap-2">
                  {(['TAX_INVOICE', 'ESTIMATE'] as InvoiceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => { setInvoiceType(type); setValidationError(null); }}
                      className={`text-[11px] py-1.5 rounded-lg border text-center font-bold transition ${
                        invoiceType === type
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      {type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Estimate'}
                    </button>
                  ))}
                </div>
                {isEstimate && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug">
                    Non-fiscal quotation — no invoice number is consumed, no stock is deducted, and no payment is collected. Convert it from the registry when the customer commits.
                  </p>
                )}

                {/* Non-hallmarked sale guard (Milestone 25, PRD §11.3). Surfaced while the bill is
                    being built, not at the till — and on an estimate too, as a heads-up that the
                    piece cannot be converted until it is hallmarked. */}
                {hallmarkViolations.length > 0 && hallmarkPolicy.enforcement !== 'OFF' && (
                  <div className={`text-[10px] rounded-lg px-2.5 py-2 leading-snug border space-y-1 ${
                    hallmarkGate.blocked
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-[#8C6D34] dark:text-[#C5A059]'
                  }`}>
                    <p className="font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      {hallmarkGate.blocked ? 'Cannot be billed — BIS HUID missing' : 'Compliance warning — BIS HUID missing'}
                    </p>
                    {hallmarkViolations.map(v => (
                      <p key={v.lineIndex}>{v.message}</p>
                    ))}
                    {isEstimate && (
                      <p className="italic opacity-80">Quoting is allowed; this must be resolved before the estimate can be converted.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Subtotal -> Discount -> GST (on the post-discount taxable value, PRD §7.4,
                  Milestone 7) -> Invoice Total; old gold NEVER reduces the taxable base
                  (PRD §8.3 / KNOWN_ISSUES.md #1) */}
              <div className="space-y-2.5 text-xs font-medium">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{invoiceSubtotal.toLocaleString('en-IN')}</span>
                </div>

                {/* Discount input */}
                <div className="pt-2 border-t flex gap-2">
                  <input
                    type="number"
                    placeholder="Discounts/Vouchers (₹)"
                    className="w-full text-xs font-mono px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Less: Discount</span>
                    <span className="font-mono">-₹{Math.min(discount, invoiceSubtotal).toLocaleString('en-IN')}</span>
                  </div>
                )}

                {/* Who made the sale (Milestone 58) — not necessarily who is billing it */}
                {!isEstimate && salespeople.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Sold By
                    </label>
                    <select
                      value={salespersonId}
                      aria-label="Salesperson"
                      onChange={e => setSalespersonId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none bg-white"
                    >
                      <option value="">Not recorded</option>
                      {salespeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Credit exposure (Milestone 57) */}
                {creditCheck && (
                  <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                    creditCheck.allowed
                      ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-400'
                  }`}>
                    <span className="font-bold">
                      {creditCheck.allowed ? 'Credit within limit' : 'Credit limit'}
                    </span>
                    {creditCheck.allowed
                      ? ` — would take ${selectedCustomer?.name ?? 'this customer'} to ₹${Math.round(creditCheck.wouldBePaisa / 100).toLocaleString('en-IN')} of ₹${Math.round(creditCheck.limitPaisa / 100).toLocaleString('en-IN')}.`
                      : ` — ${creditCheck.message}`}
                  </div>
                )}

                {/* Supervisor approval on a large discount (Milestone 33) */}
                {unapprovedDiscountError && (
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(true)}
                    className="w-full text-left flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span className="text-[11px] font-semibold text-amber-700">
                      {unapprovedDiscountError} Tap to capture it.
                    </span>
                  </button>
                )}
                {discountApprovalCovers && discountApproval && (
                  <p className="text-[11px] font-semibold text-emerald-600 flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Approved by {discountApproval.approvedBy} ({discountApproval.approverRole}) — {discountApproval.reason}
                  </p>
                )}

                {/* Statutory split (Milestone 21, PRD §7.3): CGST+SGST intra-state, IGST
                    inter-state. The halves are derived so they sum to gstTax exactly. */}
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1">Taxable Value: <Percent className="w-3 h-3 text-slate-400" /></span>
                  <span className="font-mono">₹{taxableValue.toLocaleString('en-IN')}</span>
                </div>
                {supplyType === 'INTER_STATE' ? (
                  <div className="flex justify-between text-slate-500">
                    <span>{taxLineLabels[0]}:</span>
                    <span className="font-mono">₹{gstSplit.igst.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>{taxLineLabels[0]}:</span>
                      <span className="font-mono">₹{gstSplit.cgst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{taxLineLabels[1]}:</span>
                      <span className="font-mono">₹{gstSplit.sgst.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}

                {roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span className="font-mono">{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-700 border-t pt-2.5 font-bold">
                  <span>Invoice Total (Tax Invoice):</span>
                  <span className="font-mono">₹{invoiceTotal.toLocaleString('en-IN')}</span>
                </div>

                {supplyType === 'INTER_STATE' && (
                  <p className="text-[10px] text-amber-600 font-mono">
                    Inter-state supply — place of supply {selectedCustomer?.stateCode}, branch state {activeBranch?.stateCode}.
                  </p>
                )}

                {oldGoldWeight > 0 && (
                  <div className="flex justify-between text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                    <span>Less: Old Gold Buyback (settlement):</span>
                    <span className="font-mono">-₹{oldGoldValue.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Net Amount Due. `on-gold-panel`: the light-mode sheet turns this plaque gold,
                  so its contents need black type — darkened gold on gold reads at 1.96:1. */}
              <div className="on-gold-panel bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Net Amount Due</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold font-mono text-amber-400">₹{finalGrandTotal.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400">after old-gold settlement</span>
                </div>
              </div>

              {/* Price override reason log (Milestone 10, PRD §7.1 step 4 / §15.1) */}
              {lineOverrides.length > 0 && (
                <button
                  onClick={() => setOverrideModalOpen(true)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition ${
                    unloggedOverrideError
                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {unloggedOverrideError
                      ? 'Price override needs a manager reason'
                      : 'Price override reasons logged'}
                  </span>
                  <span className="block mt-0.5 opacity-80">
                    {lineOverrides.reduce((n, l) => n + l.candidates.length, 0)} field(s) edited away from item-master values. Tap to review.
                  </span>
                </button>
              )}

              {/* PAN / Form 60 requirement (Milestone 8, PRD §4.4/§15.3 — Income Tax Rule 114B).
                  Not shown for estimates: the gate applies when the tax invoice is created. */}
              {!isEstimate && isPanRequiredFor(invoiceTotal, statutoryParameters) && (
                <button
                  onClick={() => { setPanInput(panDeclaration?.panNumber || ''); setPanModalError(''); setPanModalOpen(true); }}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition ${
                    panDeclaration
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    {panDeclaration
                      ? (panDeclaration.type === 'FORM_60' ? 'Form 60 declaration recorded' : `PAN captured: ${panDeclaration.panNumber}`)
                      : 'PAN / Form 60 required for this transaction'}
                  </span>
                  <span className="block mt-0.5 opacity-80">
                    Invoice value is ₹{statutoryParameters.panThreshold.toLocaleString('en-IN')} or above. Tap to {panDeclaration ? 'change' : 'capture'}.
                  </span>
                </button>
              )}

              {/* Payment selection — an estimate collects nothing, so this is hidden entirely */}
              <div className={`space-y-2 ${isEstimate ? 'hidden' : ''}`}>
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-400">Payment Channel</label>
                  <button
                    onClick={handleToggleSplitPayment}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                      isSplitPayment
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {isSplitPayment ? 'Single Payment' : 'Split Payment'}
                  </button>
                </div>

                {!isSplitPayment ? (
                  <div className="grid grid-cols-2 gap-2">
                    {['UPI', 'Cash', 'Card', 'Scheme Redemption', 'Credit'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMethod(mode as any)}
                        className={`text-xs py-2 rounded-xl border text-center font-bold transition ${
                          paymentMethod === mode
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Multi-tender split (Milestone 9, PRD §7.5) — the sum must equal Net Amount Due */
                  <div className="space-y-2">
                    {paymentSplit.map((entry, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={entry.mode}
                          onChange={(e) => updateSplitEntry(idx, { mode: e.target.value as PaymentMode })}
                          className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 w-2/5"
                        >
                          {(['UPI', 'Cash', 'Card', 'Scheme Redemption', 'Credit'] as PaymentMode[]).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Amount (₹)"
                          className="flex-1 text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                          value={entry.amount || ''}
                          onChange={(e) => updateSplitEntry(idx, { amount: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          onClick={() => removeSplitEntry(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                          aria-label="Remove payment line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={addSplitEntry}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-amber-500 hover:text-amber-700 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Payment Mode
                    </button>

                    <div className={`flex justify-between text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                      splitValidation.isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      <span>Split total:</span>
                      <span className="font-mono">
                        ₹{splitValidation.totalPaid.toLocaleString('en-IN')} / ₹{finalGrandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {splitValidation.error && (
                      <p className="text-[11px] text-amber-700 font-semibold">{splitValidation.error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Offline mode (Milestone 36) — said before checkout, not discovered after it */}
              {isOffline && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[11px] rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 font-medium leading-relaxed">
                  <CloudOff className="w-4 h-4 shrink-0 mt-px text-amber-600" />
                  <span>
                    This terminal is offline. The sale still completes and the customer still gets
                    their bill — it is held in the sync queue and enters the register when the
                    connection returns.
                  </span>
                </div>
              )}

              {/* Inline Validation Alert */}
              {validationError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs rounded-xl border border-rose-100 dark:border-rose-900/50 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 animate-bounce" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Action */}
              <button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-2xl shadow-lg shadow-amber-500/10 transition duration-150 uppercase tracking-wider cursor-pointer"
              >
                <Receipt className="w-4.5 h-4.5 text-slate-950" />
                {isEstimate ? 'Generate Estimate (Non-Fiscal)' : 'Generate Formal Invoice'}
              </button>
            </div>
          </div>

          {/* Manager Override Reason-Log Modal (Milestone 10, PRD §7.1 step 4 / §15.1) */}
          {isOverrideModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${
                theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
              }`}>
                <div className={`flex items-center justify-between p-5 border-b ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> Manager Override — Reason Required</h3>
                    <p className={`text-[11px] mt-0.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                      These values were edited away from the item master. Each needs a logged reason before the sale can proceed.
                    </p>
                  </div>
                  <button
                    onClick={() => setOverrideModalOpen(false)}
                    className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-900 text-zinc-500'}`}
                    aria-label="Close override reasons"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {lineOverrides.map(line => (
                    <div key={line.index} className={`rounded-xl border p-3 space-y-3 ${theme === 'light' ? 'border-slate-150 bg-slate-50/60' : 'border-zinc-800 bg-zinc-900/40'}`}>
                      <p className="text-xs font-bold">{line.item.name || `Line ${line.index + 1}`}{line.item.sku ? ` (${line.item.sku})` : ''}</p>
                      {line.candidates.map(c => {
                        const key = overrideReasonKey(line.index, c.field);
                        return (
                          <div key={c.field} className="space-y-1.5">
                            <p className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-zinc-400'}`}>
                              {OVERRIDE_FIELD_LABEL[c.field]}:{' '}
                              <span className="font-mono line-through opacity-60">{c.originalValue}</span>{' '}
                              <span className="font-mono font-bold text-amber-600">{c.newValue}</span>
                            </p>
                            <input
                              type="text"
                              placeholder="Reason for this override (min. 5 characters)"
                              className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${
                                theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                              }`}
                              value={overrideReasons[key] || ''}
                              onChange={(e) => setOverrideReasons(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className={`p-5 border-t ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                  {unloggedOverrideError && (
                    <p className="text-[11px] text-amber-700 font-semibold mb-2.5">{unloggedOverrideError}</p>
                  )}
                  <button
                    onClick={() => { setOverrideModalOpen(false); setValidationError(null); }}
                    disabled={!!unloggedOverrideError}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs py-2.5 rounded-xl transition"
                  >
                    Save Override Reasons
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAN / Form 60 Verification Modal (Milestone 8) */}
          {isPanModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
                theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
              }`}>
                <div className={`flex items-center justify-between p-5 border-b ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2"><FileCheck className="w-4 h-4 text-amber-500" /> PAN / Form 60 Verification</h3>
                    <p className={`text-[11px] mt-0.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                      Mandatory for transactions of ₹{statutoryParameters.panThreshold.toLocaleString('en-IN')} or more (Income Tax Rule 114B).
                    </p>
                  </div>
                  <button
                    onClick={() => setPanModalOpen(false)}
                    className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-900 text-zinc-500'}`}
                    aria-label="Close PAN verification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className={`text-xs p-3 rounded-xl ${theme === 'light' ? 'bg-slate-50 text-slate-600' : 'bg-zinc-900/60 text-zinc-400'}`}>
                    Invoice value: <span className="font-mono font-bold">₹{invoiceTotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                      Customer PAN
                    </label>
                    <input
                      type="text"
                      autoFocus
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      className={`w-full text-sm font-mono uppercase px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-amber-500 ${
                        theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                      }`}
                      value={panInput}
                      onChange={(e) => { setPanInput(e.target.value.toUpperCase()); setPanModalError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmPan('PAN')}
                    />
                    {panModalError && <p className="text-[11px] text-rose-500 font-semibold mt-1.5">{panModalError}</p>}
                    <p className={`text-[10px] mt-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                      Format validation only — this prototype does not verify against the Income Tax database.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmPan('PAN')}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition"
                    >
                      Confirm PAN
                    </button>
                    <button
                      onClick={() => handleConfirmPan('FORM_60')}
                      className={`flex-1 font-bold text-xs py-2.5 rounded-xl border transition ${
                        theme === 'light'
                          ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      Customer has no PAN — record Form 60
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'taxmaster' ? (
        <TaxMasterPanel taxRates={taxRates} setTaxRates={setTaxRates} />
      ) : activeTab === 'returns' ? (
        <GstReturnsPanel
          invoices={invoices}
          customers={customers}
          activeBranch={activeBranch}
          taxRates={taxRates}
        />
      ) : (
        /* SALES INVOICE REGISTRY & HISTORY TAB */
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Billed Customers</p>
                <p className="text-xl font-bold font-mono text-amber-400">{uniqueCustomersCount}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Tax Invoices</p>
                <p className="text-xl font-bold font-mono text-amber-400">{totalInvoicesCount}</p>
                {estimatesCount > 0 && (
                  <p className="text-[10px] text-slate-500 font-mono">+ {estimatesCount} estimate{estimatesCount === 1 ? '' : 's'} (non-fiscal)</p>
                )}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Net Sales Value</p>
                <p className="text-xl font-bold font-mono text-amber-400">₹{totalInvoicesValue.toLocaleString('en-IN')}</p>
                {totalReturnedValue > 0 && (
                  <p className="text-[10px] text-rose-400 font-mono">after ₹{totalReturnedValue.toLocaleString('en-IN')} returned</p>
                )}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Old Gold Received</p>
                <p className="text-xl font-bold font-mono text-amber-400">{totalOldGoldWeight.toFixed(2)} g</p>
              </div>
            </div>
          </div>

          {/* Search Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-sans font-bold text-slate-800 dark:text-slate-100 text-sm">Billing Registry & History</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Search, filter, and view details of generated jeweler bills.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, customer, phone..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white rounded-lg focus:outline-none focus:border-amber-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 uppercase font-mono text-[9px] border-b border-slate-100 dark:border-slate-800 pb-2">
                    <th className="py-3">Document No.</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Payment</th>
                    <th className="text-right">Grand Total</th>
                    {/* e-Invoice registration state (Milestone 22, PRD §9.4) */}
                    <th className="text-center">e-Invoice</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-mono">
                        No invoices found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-4 font-mono font-bold text-amber-600 dark:text-amber-500">{inv.invoiceNumber}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            inv.invoiceType === 'ESTIMATE'
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                              : inv.invoiceType === 'CREDIT_NOTE'
                                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                          }`}>
                            {inv.invoiceType === 'ESTIMATE' ? 'Estimate' : inv.invoiceType === 'CREDIT_NOTE' ? 'Credit Note' : 'Tax Invoice'}
                          </span>
                        </td>
                        <td className="font-mono text-slate-500 dark:text-slate-400">{inv.date}</td>
                        <td className="font-bold text-slate-900 dark:text-slate-100">{inv.customerName}</td>
                        <td className="font-mono text-slate-500 dark:text-slate-400">{inv.customerPhone}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inv.invoiceType === 'ESTIMATE' ? '—' : inv.paymentMethod}
                          </span>
                        </td>
                        <td className={`text-right font-mono font-bold ${
                          inv.grandTotal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {inv.grandTotal < 0 ? '-' : ''}₹{Math.abs(inv.grandTotal).toLocaleString('en-IN')}
                        </td>
                        <td className="text-center">
                          <EInvoiceBadge invoice={inv} />
                        </td>
                        <td className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoiceForDetail(inv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 dark:bg-amber-600/20 dark:hover:bg-amber-600/40 text-slate-950 dark:text-amber-400 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> View
                            </button>
                            {/* Estimates convert into a real tax invoice; already-converted ones can't be converted twice */}
                            {inv.invoiceType === 'ESTIMATE' && !inv.convertedToInvoiceNumber && (
                              <button
                                onClick={() => {
                                  setEstimateToConvert(inv);
                                  setConvertRateMode('CURRENT');
                                  setConvertPanInput(inv.panDeclaration?.panNumber || '');
                                  setConvertError('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition cursor-pointer"
                              >
                                <FileCheck className="w-3 h-3" /> Convert
                              </button>
                            )}
                            {inv.convertedToInvoiceNumber && (
                              <span className="text-[10px] font-mono text-slate-400">→ {inv.convertedToInvoiceNumber}</span>
                            )}
                            {/* Sales return — only against a tax invoice with lines left to credit (Milestone 12) */}
                            {inv.invoiceType === 'TAX_INVOICE' &&
                              (inv.returnedLineIndexesCovered || []).length < inv.items.length && (
                              <button
                                onClick={() => {
                                  setInvoiceToReturn(inv);
                                  setReturnLineSelection([]);
                                  setReturnReason('');
                                  setReturnError('');
                                  setRestockReturnedTags(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                              >
                                <TrendingDown className="w-3 h-3" /> Return
                              </button>
                            )}
                            {inv.invoiceType === 'TAX_INVOICE' && (inv.creditNoteNumbers || []).length > 0 && (
                              <span className="text-[10px] font-mono text-rose-500" title={(inv.creditNoteNumbers || []).join(', ')}>
                                {(inv.returnedLineIndexesCovered || []).length === inv.items.length ? 'fully returned' : 'part returned'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* e-Invoice cancellation — only inside the 24-hour window (PRD §9.4, Milestone 22) */}
      {eInvoiceToCancel && (
        /* z-[60], not z-50: this modal is opened FROM the invoice-detail modal, which is itself
           z-50 and later in the DOM. At equal z-index the detail overlay paints on top and
           swallows every click here, leaving the dialog visible but dead. */
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-150' : 'bg-[#141416] border-[#262626]'
          }`}>
            <div className={`flex items-center justify-between p-5 border-b ${
              theme === 'light' ? 'border-slate-100' : 'border-[#262626]'
            }`}>
              <div>
                <h3 className={`text-sm font-bold ${theme === 'light' ? 'text-slate-900' : 'text-zinc-100'}`}>
                  Cancel e-Invoice
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{eInvoiceToCancel.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setEInvoiceToCancel(null)}
                aria-label="Close e-Invoice cancellation"
                className={`p-1.5 rounded-lg transition ${
                  theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-900 text-zinc-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Cancelling withdraws the IRN on the portal. This is only possible within 24 hours of
                acknowledgement; afterwards the lawful remedy is a credit note.
              </p>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason, e.g. Wrong customer selected"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                }`}
              />
              {cancelError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {cancelError}
                </p>
              )}
            </div>
            <div className={`p-5 border-t ${theme === 'light' ? 'border-slate-100' : 'border-[#262626]'}`}>
              <button
                onClick={handleCancelEInvoice}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Return → Credit Note modal (Milestone 12, CGST Act §34) */}
      {invoiceToReturn && (() => {
        const alreadyReturned = invoiceToReturn.returnedLineIndexesCovered || [];
        const preview = calculateReturnTotals(
          invoiceToReturn.items,
          returnLineSelection,
          invoiceToReturn.subtotal,
          invoiceToReturn.discount,
          alreadyReturned
        );
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${
              theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
            }`}>
              <div className={`flex items-center justify-between p-5 border-b ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /> Sales Return — Credit Note</h3>
                  <p className={`text-[11px] mt-0.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Against {invoiceToReturn.invoiceNumber} dated {invoiceToReturn.date}
                  </p>
                </div>
                <button
                  onClick={() => { setInvoiceToReturn(null); setReturnError(''); }}
                  className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-900 text-zinc-500'}`}
                  aria-label="Close sales return"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-2 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Items Being Returned
                  </label>
                  <div className="space-y-1.5">
                    {invoiceToReturn.items.map((item, idx) => {
                      const isCredited = alreadyReturned.includes(idx);
                      const isChecked = returnLineSelection.includes(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 text-xs border rounded-lg px-3 py-2 transition ${
                            isCredited
                              ? 'opacity-50 cursor-not-allowed ' + (theme === 'light' ? 'border-slate-150 bg-slate-50' : 'border-zinc-800 bg-zinc-900/40')
                              : 'cursor-pointer ' + (isChecked
                                  ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
                                  : theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-zinc-800 hover:bg-zinc-900')
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isCredited}
                            checked={isChecked}
                            onChange={(e) => {
                              setReturnError('');
                              setReturnLineSelection(prev =>
                                e.target.checked ? [...prev, idx] : prev.filter(i => i !== idx)
                              );
                            }}
                            className="accent-rose-500"
                          />
                          <span className="flex-1">
                            <span className={`font-bold block ${isChecked ? 'text-rose-900 dark:text-rose-300' : ''}`}>{item.name}</span>
                            {item.sku && <span className={`font-mono text-[10px] ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>{item.sku}</span>}
                            {isCredited && <span className="text-[10px] text-rose-500 font-semibold ml-1.5">already credited</span>}
                          </span>
                          <span className="font-mono font-bold">₹{item.subtotal.toLocaleString('en-IN')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Reason for Return
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Size exchange requested by customer"
                    className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-rose-400 ${
                      theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                    }`}
                    value={returnReason}
                    onChange={(e) => { setReturnReason(e.target.value); setReturnError(''); }}
                  />
                </div>

                <label className={`flex items-start gap-2.5 text-xs p-3 rounded-xl border cursor-pointer ${
                  theme === 'light' ? 'border-slate-200 bg-slate-50/60' : 'border-zinc-800 bg-zinc-900/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={restockReturnedTags}
                    onChange={(e) => setRestockReturnedTags(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    <span className="font-bold block">Passed QC — return straight to sellable stock</span>
                    <span className={theme === 'light' ? 'text-slate-500' : 'text-zinc-500'}>
                      Leave unchecked to hold the piece as “Returned (Pending QC)” for inspection or re-polishing before it can be sold again.
                    </span>
                  </span>
                </label>

                {/* Live reversal preview */}
                {returnLineSelection.length > 0 && (
                  <div className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                    theme === 'light' ? 'border-rose-200 bg-rose-50/50' : 'border-rose-900/40 bg-rose-950/20'
                  }`}>
                    <div className="flex justify-between"><span>Returned value:</span><span className="font-mono">₹{Math.abs(preview.returnedSubtotal).toLocaleString('en-IN')}</span></div>
                    {preview.discountReversed !== 0 && (
                      <div className="flex justify-between"><span>Discount clawed back (pro-rata):</span><span className="font-mono">₹{Math.abs(preview.discountReversed).toLocaleString('en-IN')}</span></div>
                    )}
                    <div className="flex justify-between"><span>GST reversed:</span><span className="font-mono">₹{Math.abs(preview.returnedTax).toLocaleString('en-IN')}</span></div>
                    <div className={`flex justify-between font-bold border-t pt-1.5 ${theme === 'light' ? 'border-rose-200' : 'border-rose-900/40'}`}>
                      <span>Refund due to customer:</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">₹{Math.abs(preview.returnedTotal).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}

                {returnError && <p className="text-[11px] text-rose-500 font-semibold">{returnError}</p>}
              </div>

              <div className={`p-5 border-t ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
                <button
                  onClick={handleCreateCreditNote}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 rounded-xl transition"
                >
                  Raise Credit Note
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Estimate → Tax Invoice conversion modal (Milestone 11, PRD §7.8) */}
      {estimateToConvert && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
            theme === 'light' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-[#141416] border-zinc-800 text-zinc-100'
          }`}>
            <div className={`flex items-center justify-between p-5 border-b ${theme === 'light' ? 'border-slate-100' : 'border-zinc-800'}`}>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><FileCheck className="w-4 h-4 text-amber-500" /> Convert to Tax Invoice</h3>
                <p className={`text-[11px] mt-0.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                  {estimateToConvert.invoiceNumber} → a new, sequential GST tax invoice.
                </p>
              </div>
              <button
                onClick={() => { setEstimateToConvert(null); setConvertError(''); }}
                className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-900 text-zinc-500'}`}
                aria-label="Close conversion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-2 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                  Metal Rate to Apply
                </label>
                <div className="space-y-2">
                  {([
                    { mode: 'CURRENT' as const, label: "Re-price at today's rate", hint: "Recalculates every line against the current live rate." },
                    { mode: 'ORIGINAL' as const, label: 'Honor the quoted rate', hint: 'Keeps the exact figures the customer was quoted.' }
                  ]).map(opt => (
                    <button
                      key={opt.mode}
                      onClick={() => setConvertRateMode(opt.mode)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                        convertRateMode === opt.mode
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : theme === 'light'
                            ? 'border-slate-200 hover:bg-slate-50 text-slate-600'
                            : 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      <span className="font-bold block">{opt.label}</span>
                      <span className="block mt-0.5 opacity-75">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* The PAN gate skipped at estimate time applies now, against the converted value */}
              {isPanRequiredFor(estimateToConvert.grandTotal, statutoryParameters) && (
                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Customer PAN (required at ₹{statutoryParameters.panThreshold.toLocaleString('en-IN')}+)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    className={`w-full text-sm font-mono uppercase px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-amber-500 ${
                      theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                    }`}
                    value={convertPanInput}
                    onChange={(e) => { setConvertPanInput(e.target.value.toUpperCase()); setConvertError(''); }}
                  />
                </div>
              )}

              {convertError && <p className="text-[11px] text-rose-500 font-semibold">{convertError}</p>}

              <p className={`text-[10px] leading-snug ${theme === 'light' ? 'text-slate-400' : 'text-zinc-500'}`}>
                On conversion the linked stock is marked Sold and the estimate is stamped as converted so it cannot be billed twice.
              </p>

              <button
                onClick={handleConvertEstimate}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition"
              >
                Create Tax Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Backdrop Modal */}
      {selectedInvoiceForDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-2xl max-w-2xl w-full relative my-8 text-slate-800">
            <div className="absolute top-6 right-6 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-lg transition cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print {selectedInvoiceForDetail.invoiceType === 'ESTIMATE' ? 'Estimate' : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'Credit Note' : 'Invoice'}
              </button>
              <button
                onClick={() => setSelectedInvoiceForDetail(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Core Printable Tax Invoice */}
            <div className="space-y-6 pt-6 print:pt-0" id="print-area">
              {/* Header */}
              <div className="text-center border-b pb-4 space-y-1">
                <h1 className="font-sans font-black text-2xl tracking-wider text-slate-900">STITCH JEWELLERY HOUSE</h1>
                {/* Rule 46: the issuing branch's own address and GSTIN, not a hardcoded HQ one */}
                <p className="text-xs text-slate-500">{activeBranch?.address || '102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002'}</p>
                <p className="text-[10px] font-mono text-slate-400">Tel: +91 22 2240 8710 | GSTIN: {activeBranch?.gstin || '27AACCS9948H1Z1'}</p>
                <h2 className={`text-xs uppercase font-bold py-1 tracking-widest rounded mt-3 ${
                  selectedInvoiceForDetail.invoiceType === 'ESTIMATE'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE'
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : 'bg-slate-100 text-slate-700'
                }`}>
                  {selectedInvoiceForDetail.invoiceType === 'ESTIMATE'
                    ? 'ESTIMATE — NOT A TAX INVOICE'
                    : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE'
                      ? 'CREDIT NOTE (SALES RETURN)'
                      : 'TAX INVOICE'}
                </h2>
              </div>

              {/* A credit note must reference the original invoice's number and date (CGST §34) */}
              {selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 space-y-0.5">
                  <p className="font-bold">
                    Issued against Tax Invoice {selectedInvoiceForDetail.creditNoteAgainstInvoice} dated {selectedInvoiceForDetail.creditNoteAgainstInvoiceDate}
                  </p>
                  {selectedInvoiceForDetail.returnReason && (
                    <p>Reason: <span className="italic">{selectedInvoiceForDetail.returnReason}</span></p>
                  )}
                </div>
              )}

              {/* Info details */}
              <div className="grid grid-cols-2 text-xs font-medium text-slate-600 gap-y-2">
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">
                    {selectedInvoiceForDetail.invoiceType === 'ESTIMATE'
                      ? 'Estimate Number:'
                      : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE'
                        ? 'Credit Note Number:'
                        : 'Invoice Number:'}
                  </span></p>
                  <p className="font-mono font-bold text-slate-900 text-sm">{selectedInvoiceForDetail.invoiceNumber}</p>
                  {selectedInvoiceForDetail.convertedToInvoiceNumber && (
                    <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Converted → {selectedInvoiceForDetail.convertedToInvoiceNumber}</p>
                  )}
                  {selectedInvoiceForDetail.convertedFromEstimateNumber && (
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Converted from estimate {selectedInvoiceForDetail.convertedFromEstimateNumber}</p>
                  )}
                  {(selectedInvoiceForDetail.creditNoteNumbers || []).length > 0 && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                      Credit note{(selectedInvoiceForDetail.creditNoteNumbers || []).length > 1 ? 's' : ''}: {(selectedInvoiceForDetail.creditNoteNumbers || []).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Date:</span></p>
                  <p className="font-mono text-slate-900">{selectedInvoiceForDetail.date}</p>
                </div>
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Billed To:</span></p>
                  <p className="font-bold text-slate-900">{selectedInvoiceForDetail.customerName}</p>
                  <p className="font-mono text-slate-500">{selectedInvoiceForDetail.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Cashier / Operator:</span></p>
                  <p className="font-bold text-slate-900">Prathamesh S.</p>
                  <p className="font-mono text-slate-500">Counter Terminal #1</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-t border-b py-2">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="text-slate-400 uppercase font-mono text-[9px] border-b pb-2">
                      <th className="py-2">Item Description</th>
                      <th>Standard</th>
                      {/* Rule 46 requires the HSN code printed against every line */}
                      <th>HSN</th>
                      <th className="text-right">Net Wt</th>
                      <th className="text-right">Metal Rate</th>
                      <th className="text-right">Wastage + MC + Stones</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-800">
                    {selectedInvoiceForDetail.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                        </td>
                        <td className="font-mono text-slate-500">
                          {item.metalType}
                          {/* Rule 46 / PRD §9.3: the HUID must appear against each hallmarked piece */}
                          {item.huid && <span className="block text-[9px] text-slate-400">HUID: {item.huid}</span>}
                        </td>
                        <td className="font-mono text-slate-500">{item.hsnCode || '7113'}</td>
                        <td className="text-right font-mono">{item.netWeight.toFixed(2)} g</td>
                        <td className="text-right font-mono">₹{item.goldPrice ? Math.round(item.goldPrice / item.netWeight).toLocaleString('en-IN') : '-'}</td>
                        <td className="text-right font-mono">₹{(item.wastageValue + item.makingCharge + item.stoneCharge).toLocaleString('en-IN')}</td>
                        <td className="text-right font-mono font-bold text-slate-900 py-3">₹{item.subtotal.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Price Calculations breakdown */}
              <div className="w-1/2 ml-auto text-xs font-medium space-y-2">
                {/* A credit note's stored figures are all negative; shown as positive amounts
                    under reversal labels so staff aren't reading "₹-40,582" off a document. */}
                <div className="flex justify-between text-slate-500">
                  <span>{selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'Returned Value:' : 'Subtotal:'}</span>
                  <span className="font-mono">₹{Math.abs(selectedInvoiceForDetail.subtotal).toLocaleString('en-IN')}</span>
                </div>
                {selectedInvoiceForDetail.discount !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>{selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'Discount Clawed Back (pro-rata):' : 'Discount Code Applied:'}</span>
                    <span className="font-mono">-₹{Math.abs(selectedInvoiceForDetail.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <InvoiceTaxLines invoice={selectedInvoiceForDetail} />
                <div className={`flex justify-between font-black border-t-2 pt-2 text-sm px-2 py-1.5 rounded ${
                  selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'bg-rose-50 text-rose-900' : 'bg-amber-50 text-slate-900'
                }`}>
                  <span>
                    {selectedInvoiceForDetail.invoiceType === 'ESTIMATE'
                      ? 'Estimate Total (Indicative):'
                      : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE'
                        ? 'Total Credit Note Value:'
                        : 'Invoice Total (Tax Invoice):'}
                  </span>
                  <span className={`font-mono font-bold ${selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'text-rose-700' : 'text-amber-800'}`}>
                    ₹{Math.abs(selectedInvoiceForDetail.grandTotal).toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedInvoiceForDetail.oldGoldWeight > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">
                    <span>Less: Old Gold Buyback ({selectedInvoiceForDetail.oldGoldWeight}g, settlement only):</span>
                    <span className="font-mono">-₹{selectedInvoiceForDetail.oldGoldValue.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className={`flex justify-between font-black border-t-2 pt-2 text-sm px-2 py-1.5 rounded ${
                  selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'bg-rose-50 text-rose-900' : 'bg-amber-50 text-slate-900'
                }`}>
                  <span>
                    {selectedInvoiceForDetail.invoiceType === 'ESTIMATE'
                      ? 'Estimated Payable:'
                      : selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE'
                        ? 'Refund Due to Customer:'
                        : 'Net Amount Due:'}
                  </span>
                  <span className={`font-mono font-bold ${selectedInvoiceForDetail.invoiceType === 'CREDIT_NOTE' ? 'text-rose-700' : 'text-amber-800'}`}>
                    ₹{Math.abs(selectedInvoiceForDetail.netAmountDue).toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedInvoiceForDetail.invoiceType === 'ESTIMATE' && (
                  <p className="text-[10px] text-amber-700 pt-1 leading-snug">
                    Indicative only, subject to the prevailing metal rate on the date of purchase. Not valid for GST input credit.
                  </p>
                )}

                {/* Multi-tender breakdown (PRD §7.5) */}
                {selectedInvoiceForDetail.paymentSplit && selectedInvoiceForDetail.paymentSplit.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-dashed border-slate-200 space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Settled Via</p>
                    {selectedInvoiceForDetail.paymentSplit.map((entry, idx) => (
                      <div key={idx} className="flex justify-between text-slate-500">
                        <span>{entry.mode}</span>
                        <span className="font-mono">₹{entry.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* e-Invoice / IRN panel (Milestone 22, PRD §9.4) — SIMULATED, never a real IRP call */}
              {isEInvoiceApplicable(selectedInvoiceForDetail) && (() => {
                const rec = selectedInvoiceForDetail.eInvoice;
                const status = rec?.status ?? 'PENDING';
                const cancellable = canCancelEInvoice(rec);
                const hoursLeft = hoursUntilCancellationCloses(rec);
                return (
                  <div className="p-4 rounded-xl border border-slate-150 bg-slate-50 space-y-3 print:break-inside-avoid">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-amber-600" /> e-Invoice (IRN)
                        <span className="font-normal text-slate-400 font-mono text-[9px]">SIMULATED — no IRP call</span>
                      </p>
                      <EInvoiceBadge invoice={selectedInvoiceForDetail} />
                    </div>

                    {status === 'GENERATED' && rec?.irn && (
                      <div className="flex gap-4 items-start">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0">
                          {/* A real QR of the payload, not a placeholder box */}
                          <QRCodeSVG value={rec.signedQrPayload || rec.irn} size={92} level="M" />
                        </div>
                        <div className="text-[10px] text-slate-500 space-y-1 min-w-0">
                          <p><span className="font-bold text-slate-600">IRN:</span></p>
                          <p className="font-mono break-all leading-tight text-slate-500">{rec.irn}</p>
                          <p><span className="font-bold text-slate-600">Ack No:</span> <span className="font-mono">{rec.ackNo}</span></p>
                          <p><span className="font-bold text-slate-600">Ack Date:</span> <span className="font-mono">{rec.ackDate?.slice(0, 19).replace('T', ' ')}</span></p>
                        </div>
                      </div>
                    )}

                    {status === 'FAILED' && (
                      <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                        {rec?.failureReason} · attempt {rec?.attempts}
                      </p>
                    )}

                    {status === 'CANCELLED' && (
                      <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Cancelled on {rec?.cancelledOn?.slice(0, 10)} — {rec?.cancelReason}. A credit note is the remedy after this point.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 print:hidden">
                      {(status === 'PENDING' || status === 'FAILED') && (
                        <>
                          <button
                            onClick={() => handleSubmitEInvoice(selectedInvoiceForDetail, false)}
                            className="px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
                          >
                            {status === 'FAILED' ? 'Retry Submission' : 'Simulate Submission'}
                          </button>
                          <button
                            onClick={() => handleSubmitEInvoice(selectedInvoiceForDetail, true)}
                            className="px-3 py-1.5 text-[10px] font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="Exercise the failure/retry path deliberately"
                          >
                            Simulate Gateway Failure
                          </button>
                        </>
                      )}
                      {status === 'GENERATED' && (
                        cancellable ? (
                          <button
                            onClick={() => { setEInvoiceToCancel(selectedInvoiceForDetail); setCancelReason(''); setCancelError(''); }}
                            className="px-3 py-1.5 text-[10px] font-bold border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            Cancel e-Invoice{hoursLeft !== null ? ` (${hoursLeft}h left)` : ''}
                          </button>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            The 24-hour cancellation window has closed — raise a credit note instead.
                          </p>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Hallmark Warranty declaration — tax invoices only (see the receipt view above) */}
              {selectedInvoiceForDetail.invoiceType === 'TAX_INVOICE' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-500 space-y-1.5">
                  <p className="font-bold text-slate-700 flex items-center gap-1">
                    <FileCheck className="w-4 h-4 text-amber-600" /> BIS Hallmark & Quality Warranty
                  </p>
                  <p>Certified that all gold items listed are BIS Hallmarked with HUID values. Diamonds are verified with IGI/GIA certifications. Returns/Buybacks are accepted on prevailing market rates subject to standard melting purity tests.</p>
                </div>
              )}

              {/* Signature fields */}
              <div className="grid grid-cols-2 pt-10 text-center text-[10px] font-semibold text-slate-400">
                <div>
                  <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Customer Signature</p>
                </div>
                <div>
                  <p className="border-t border-slate-200 pt-2 w-32 mx-auto">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor approval for a large discount (Milestone 33) */}
      {isPinModalOpen && (
        <SupervisorPinModal
          request={{
            kind: 'LARGE_DISCOUNT',
            amount: discount,
            reason: '',
            requestedBy: currentUserName,
          }}
          supervisors={supervisors}
          onApproved={record => {
            setDiscountApproval(record);
            onApprovalRecorded(record);
            setPinModalOpen(false);
            setValidationError(null);
          }}
          onClose={() => setPinModalOpen(false)}
        />
      )}
    </div>
  );
}
