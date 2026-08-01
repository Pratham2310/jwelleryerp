/**
 * Reports Hub (PRD §14.2–14.9, Milestone 30).
 *
 * Every figure here is **derived** from the transactional state, never stored. The milestone's own
 * acceptance criterion is that each report's totals reconcile against what they are drawn from,
 * so the functions below are written to make that checkable rather than merely plausible.
 *
 * ─── Two rules that decide whether a sales report is right or quietly wrong ─────────────
 *
 * **1. Revenue must respect document type.** An ESTIMATE is a quotation, not a supply, and must
 * never count. A CREDIT_NOTE carries negative figures, so *including* it is what makes revenue
 * net of returns automatically. Get either backwards and every sales number in the app is wrong
 * in a way that still looks reasonable — this has been the recurring trap since Milestone 11.
 *
 * **2. An undated tag is "unknown age", never "new".** Inventory ageing exists to find capital
 * sitting in slow-moving stock. Defaulting a missing `taggedOn` to today would report zero old
 * stock — hiding precisely the problem the report was opened to find. Unknowns are counted and
 * shown separately so the gap is visible instead of flattering.
 */

import type {
  SaleInvoice, Tag, Customer, Supplier, Karigar, KarigarLedgerEntry,
  PurchaseInvoice, Branch, MetalRate,
} from '../types';
import { sumMoney, sumWeight, roundMoney, roundWeight } from './money';
import { isSellable } from './tagStateMachine';
import { deriveKarigarBalance } from './fineGoldLedger';
import { isPanRequired } from './statutoryChecks';

/** Documents that count as revenue: real invoices and the credit notes that net against them. */
export function fiscalDocuments(invoices: SaleInvoice[]): SaleInvoice[] {
  return invoices.filter(i => i.invoiceType === 'TAX_INVOICE' || i.invoiceType === 'CREDIT_NOTE');
}

export function inPeriod<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter(r => r.date >= from && r.date <= to);
}

/* ─────────────────────────────── Sales ─────────────────────────────── */

export interface DailySalesRow {
  date: string;
  invoices: number;
  creditNotes: number;
  taxableValue: number;
  tax: number;
  total: number;
}

export function dailySalesSummary(
  invoices: SaleInvoice[], from: string, to: string
): DailySalesRow[] {
  const rows = inPeriod(fiscalDocuments(invoices), from, to);
  const byDate = new Map<string, SaleInvoice[]>();
  for (const inv of rows) byDate.set(inv.date, [...(byDate.get(inv.date) ?? []), inv]);

  return [...byDate.entries()]
    .map(([date, docs]) => ({
      date,
      invoices: docs.filter(d => d.invoiceType === 'TAX_INVOICE').length,
      creditNotes: docs.filter(d => d.invoiceType === 'CREDIT_NOTE').length,
      taxableValue: sumMoney(docs.map(d => d.subtotal - (d.discount || 0))),
      tax: sumMoney(docs.map(d => d.tax)),
      total: sumMoney(docs.map(d => d.grandTotal)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SalesRegisterRow {
  invoiceNumber: string;
  date: string;
  customerName: string;
  type: SaleInvoice['invoiceType'];
  taxableValue: number;
  tax: number;
  total: number;
}

export function salesRegister(
  invoices: SaleInvoice[], from: string, to: string
): SalesRegisterRow[] {
  return inPeriod(fiscalDocuments(invoices), from, to)
    .map(i => ({
      invoiceNumber: i.invoiceNumber,
      date: i.date,
      customerName: i.customerName || 'Walk-in',
      type: i.invoiceType,
      taxableValue: roundMoney(i.subtotal - (i.discount || 0)),
      tax: i.tax,
      total: i.grandTotal,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

export interface SalesTotals {
  documents: number;
  taxableValue: number;
  tax: number;
  total: number;
  estimatesExcluded: number;
}

/**
 * The reconciliation figure. `total` here must equal the sum of `grandTotal` across the same
 * fiscal documents — which is what the milestone asks to be checkable.
 */
export function salesTotals(invoices: SaleInvoice[], from: string, to: string): SalesTotals {
  const docs = inPeriod(fiscalDocuments(invoices), from, to);
  const estimates = inPeriod(invoices.filter(i => i.invoiceType === 'ESTIMATE'), from, to);
  return {
    documents: docs.length,
    taxableValue: sumMoney(docs.map(d => d.subtotal - (d.discount || 0))),
    tax: sumMoney(docs.map(d => d.tax)),
    total: sumMoney(docs.map(d => d.grandTotal)),
    estimatesExcluded: estimates.length,
  };
}

/* ─────────────────────────────── Inventory ─────────────────────────────── */

export interface StockSummaryRow {
  metalType: string;
  pieces: number;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
}

export function stockSummary(tags: Tag[], rates: MetalRate[]): StockSummaryRow[] {
  const held = tags.filter(t => isSellable(t.status));
  const byMetal = new Map<string, Tag[]>();
  for (const t of held) byMetal.set(t.metalType, [...(byMetal.get(t.metalType) ?? []), t]);

  return [...byMetal.entries()]
    .map(([metalType, list]) => {
      const rate = rates.find(r => r.metalType === metalType)?.ratePerGram ?? 0;
      return {
        metalType,
        pieces: list.length,
        grossWeight: sumWeight(list.map(t => t.grossWeight)),
        netWeight: sumWeight(list.map(t => t.netWeight)),
        // Metal + stones, excluding making charge — the same basis as a stock transfer (M20).
        estimatedValue: sumMoney(list.map(t => t.netWeight * rate + (t.stoneCharge || 0))),
      };
    })
    .sort((a, b) => a.metalType.localeCompare(b.metalType));
}

export type AgeBucket = '0-90' | '91-180' | '181-365' | '365+' | 'unknown';

export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  '0-90': 'Under 90 days',
  '91-180': '91–180 days',
  '181-365': '181–365 days',
  '365+': 'Over a year',
  unknown: 'Date not recorded',
};

export function daysHeld(taggedOn: string | undefined, today: string): number | null {
  if (!taggedOn) return null;
  const from = new Date(`${taggedOn}T00:00:00Z`).getTime();
  const to = new Date(`${today}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 86400000));
}

export function ageBucketOf(days: number | null): AgeBucket {
  // An unknown date is its own bucket — never folded into the newest one.
  if (days === null) return 'unknown';
  if (days <= 90) return '0-90';
  if (days <= 180) return '91-180';
  if (days <= 365) return '181-365';
  return '365+';
}

export interface AgeingRow {
  bucket: AgeBucket;
  pieces: number;
  netWeight: number;
  estimatedValue: number;
}

export function inventoryAgeing(
  tags: Tag[], rates: MetalRate[], today: string = new Date().toISOString().slice(0, 10)
): AgeingRow[] {
  const held = tags.filter(t => isSellable(t.status));
  const buckets: AgeBucket[] = ['0-90', '91-180', '181-365', '365+', 'unknown'];

  return buckets.map(bucket => {
    const list = held.filter(t => ageBucketOf(daysHeld(t.taggedOn, today)) === bucket);
    return {
      bucket,
      pieces: list.length,
      netWeight: sumWeight(list.map(t => t.netWeight)),
      estimatedValue: sumMoney(list.map(t => {
        const rate = rates.find(r => r.metalType === t.metalType)?.ratePerGram ?? 0;
        return t.netWeight * rate + (t.stoneCharge || 0);
      })),
    };
  }).filter(r => r.pieces > 0);
}

/** Capital tied up in stock older than the threshold — the figure the report exists for. */
export function slowMovingValue(rows: AgeingRow[], thresholdDays = 180): number {
  const slow: AgeBucket[] = thresholdDays <= 90
    ? ['91-180', '181-365', '365+']
    : ['181-365', '365+'];
  return sumMoney(rows.filter(r => slow.includes(r.bucket)).map(r => r.estimatedValue));
}

/* ─────────────────────────────── Customer ─────────────────────────────── */

export interface CustomerHistoryEntry {
  invoiceNumber: string;
  date: string;
  type: SaleInvoice['invoiceType'];
  total: number;
  itemCount: number;
}

/** One customer's documents, newest first. Estimates included — they are part of the story. */
export function customerHistory(invoices: SaleInvoice[], customerName: string): CustomerHistoryEntry[] {
  const target = (customerName || '').trim().toLowerCase();
  return invoices
    .filter(i => (i.customerName || '').trim().toLowerCase() === target)
    .map(i => ({
      invoiceNumber: i.invoiceNumber,
      date: i.date,
      type: i.invoiceType,
      total: i.grandTotal,
      itemCount: i.items?.length ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNumber.localeCompare(a.invoiceNumber));
}

export interface CustomerProfile {
  lifetimeValue: number;
  purchaseCount: number;
  returnCount: number;
  estimateCount: number;
  firstPurchase: string | null;
  lastPurchase: string | null;
  averageTicket: number;
}

export function customerProfile(invoices: SaleInvoice[], customerName: string): CustomerProfile {
  const all = customerHistory(invoices, customerName);
  const fiscal = all.filter(e => e.type === 'TAX_INVOICE' || e.type === 'CREDIT_NOTE');
  const purchases = all.filter(e => e.type === 'TAX_INVOICE');
  const dates = fiscal.map(e => e.date).sort();

  return {
    // Net of returns, because credit notes carry negative totals.
    lifetimeValue: sumMoney(fiscal.map(e => e.total)),
    purchaseCount: purchases.length,
    returnCount: all.filter(e => e.type === 'CREDIT_NOTE').length,
    estimateCount: all.filter(e => e.type === 'ESTIMATE').length,
    firstPurchase: dates[0] ?? null,
    lastPurchase: dates[dates.length - 1] ?? null,
    averageTicket: purchases.length
      ? roundMoney(sumMoney(purchases.map(e => e.total)) / purchases.length)
      : 0,
  };
}

export interface TierRow { tier: string; customers: number; lifetimeSpend: number }

export function tierDistribution(customers: Customer[]): TierRow[] {
  const byTier = new Map<string, Customer[]>();
  for (const c of customers) byTier.set(c.tier, [...(byTier.get(c.tier) ?? []), c]);
  return [...byTier.entries()]
    .map(([tier, list]) => ({
      tier, customers: list.length, lifetimeSpend: sumMoney(list.map(c => c.lifetimeSpend || 0)),
    }))
    .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
}

export interface PanException {
  invoiceNumber: string;
  date: string;
  customerName: string;
  total: number;
}

/**
 * Invoices at or above the PAN threshold with no declaration recorded (Rule 114B).
 * Milestone 8 blocks this going forward; this finds anything that predates the gate.
 */
export function panComplianceExceptions(invoices: SaleInvoice[]): PanException[] {
  return invoices
    .filter(i => i.invoiceType === 'TAX_INVOICE')
    .filter(i => isPanRequired(i.grandTotal) && !i.panDeclaration)
    .map(i => ({
      invoiceNumber: i.invoiceNumber, date: i.date,
      customerName: i.customerName || 'Walk-in', total: i.grandTotal,
    }))
    .sort((a, b) => b.total - a.total);
}

/* ─────────────────────────────── Karigar ─────────────────────────────── */

export interface KarigarReconRow {
  karigarId: string;
  name: string;
  fineWeightPayable: number;
  moneyPayable: number;
  entries: number;
}

export function karigarReconciliation(
  karigars: Karigar[], ledger: KarigarLedgerEntry[]
): KarigarReconRow[] {
  return karigars
    .map(k => {
      const balance = deriveKarigarBalance(ledger, k.id);
      return {
        karigarId: k.id,
        name: k.name,
        fineWeightPayable: balance.fineWeightPayable,
        moneyPayable: balance.moneyPayable,
        entries: ledger.filter(e => e.karigarId === k.id).length,
      };
    })
    // Weight and money are reported side by side but never netted — decision D-2.
    .sort((a, b) => b.fineWeightPayable - a.fineWeightPayable);
}

/* ─────────────────────────────── Purchase ─────────────────────────────── */

export interface SupplierPurchaseRow {
  supplierId: string;
  name: string;
  invoices: number;
  taxableValue: number;
  claimableItc: number;
  reverseChargeLiability: number;
}

export function supplierPurchases(
  purchaseInvoices: PurchaseInvoice[], suppliers: Supplier[]
): SupplierPurchaseRow[] {
  const bySupplier = new Map<string, PurchaseInvoice[]>();
  for (const p of purchaseInvoices) {
    bySupplier.set(p.supplierId, [...(bySupplier.get(p.supplierId) ?? []), p]);
  }

  return [...bySupplier.entries()]
    .map(([supplierId, list]) => ({
      supplierId,
      name: suppliers.find(s => s.id === supplierId)?.name ?? 'Unknown supplier',
      invoices: list.length,
      taxableValue: sumMoney(list.map(p => p.taxableValue)),
      claimableItc: sumMoney(list.filter(p => p.itcEligible).map(p => p.totalTax)),
      // Kept apart from claimable credit: one is owed BY the shop, the other TO it.
      reverseChargeLiability: sumMoney(list.filter(p => p.isReverseCharge).map(p => p.totalTax)),
    }))
    .sort((a, b) => b.taxableValue - a.taxableValue);
}

/* ─────────────────────────────── Branch ─────────────────────────────── */

export interface BranchComparisonRow {
  branchId: string;
  name: string;
  sellablePieces: number;
  stockWeight: number;
  salesValue: number;
}

export function branchComparison(
  branches: Branch[], tags: Tag[], invoices: SaleInvoice[], from: string, to: string
): BranchComparisonRow[] {
  const docs = inPeriod(fiscalDocuments(invoices), from, to);
  return branches.map(b => {
    const held = tags.filter(t => t.branchId === b.id && isSellable(t.status));
    return {
      branchId: b.id,
      name: b.name,
      sellablePieces: held.length,
      stockWeight: sumWeight(held.map(t => t.netWeight)),
      salesValue: sumMoney(docs.filter(i => i.branchId === b.id).map(i => i.grandTotal)),
    };
  }).sort((a, b) => b.salesValue - a.salesValue);
}

/* ─────────────────────────────── Reconciliation ─────────────────────────────── */

export interface ReconciliationCheck {
  label: string;
  reportTotal: number;
  sourceTotal: number;
  reconciles: boolean;
  difference: number;
}

/**
 * The milestone's acceptance criterion, made executable: each report's total is compared to the
 * state it was derived from. Surfaced in the UI so a mismatch is visible rather than assumed away.
 */
export function reconcileReports(
  invoices: SaleInvoice[], tags: Tag[], rates: MetalRate[], from: string, to: string
): ReconciliationCheck[] {
  const totals = salesTotals(invoices, from, to);
  const sourceSales = sumMoney(inPeriod(fiscalDocuments(invoices), from, to).map(i => i.grandTotal));
  const daily = sumMoney(dailySalesSummary(invoices, from, to).map(r => r.total));
  const register = sumMoney(salesRegister(invoices, from, to).map(r => r.total));

  const summary = stockSummary(tags, rates);
  const ageing = inventoryAgeing(tags, rates, to);
  const summaryPieces = summary.reduce((s, r) => s + r.pieces, 0);
  const ageingPieces = ageing.reduce((s, r) => s + r.pieces, 0);

  const check = (label: string, reportTotal: number, sourceTotal: number): ReconciliationCheck => ({
    label,
    reportTotal: roundMoney(reportTotal),
    sourceTotal: roundMoney(sourceTotal),
    reconciles: roundMoney(reportTotal) === roundMoney(sourceTotal),
    difference: roundMoney(reportTotal - sourceTotal),
  });

  return [
    check('Daily Sales Summary vs invoice register', daily, sourceSales),
    check('Sales Register vs invoice register', register, sourceSales),
    check('Sales totals vs invoice register', totals.total, sourceSales),
    check('Ageing piece count vs stock summary', ageingPieces, summaryPieces),
    check(
      'Ageing value vs stock summary',
      sumMoney(ageing.map(r => r.estimatedValue)),
      sumMoney(summary.map(r => r.estimatedValue))
    ),
  ];
}

export function stockWeightTotal(rows: StockSummaryRow[]): number {
  return roundWeight(sumWeight(rows.map(r => r.netWeight)));
}
