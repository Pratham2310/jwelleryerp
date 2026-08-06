/**
 * Customer Credit & Receivables Ageing (Milestone 57, PRD §7.7/§10.6).
 *
 * Indian jewellers sell on credit constantly — to regulars, to family, against a wedding. The
 * `Customer.creditLimit` field has existed since the first schema and nothing has ever enforced
 * it, which means the app happily lets a shop lend unlimited gold to anyone.
 *
 * ─── Allocation must be explicit, never implied ───────────────────────────────────────
 * The temptation is to treat a customer's outstanding as one number and a receipt as a reduction
 * of it. That is how home-grown systems lose the answer to *"which bill did this payment settle?"*
 * — the exact question asked in a dispute, in a credit-note reversal, and by an auditor.
 *
 * So a receipt carries **allocations**: an explicit list of invoice numbers and amounts. FIFO is
 * offered as a *suggestion* (`suggestFifoAllocation`) because it is what most shops mean, but the
 * allocation that gets stored is the one someone actually confirmed, and it can never exceed
 * either the receipt or the invoice it points at.
 *
 * ─── Ageing is measured from the invoice date, not the due date ───────────────────────
 * A shop that gives 30 days' credit and ages from the due date shows a bill 45 days old as "15
 * days" — flattering, and useless for collection. Ageing here is days since the invoice, with the
 * credit period reported separately so the two are never confused.
 */

import type { SaleInvoice, Customer } from '../types';
import { roundMoney, sumMoney } from './money';

export const AGE_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
export type AgeBucket = typeof AGE_BUCKETS[number];

export const BUCKET_LABEL: Record<AgeBucket, string> = {
  '0-30': 'Under 30 days',
  '31-60': '31 – 60 days',
  '61-90': '61 – 90 days',
  '90+': 'Over 90 days',
};

/** Default credit period when the customer has none set. Reported, never used to age. */
export const DEFAULT_CREDIT_DAYS = 30;

export interface ReceiptAllocation {
  invoiceNumber: string;
  amountPaisa: number;
}

export interface CustomerReceipt {
  id: string;
  receiptNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  amountPaisa: number;
  mode: string;
  /** Explicit, and the reason this module exists. */
  allocations: ReceiptAllocation[];
  receivedBy: string;
  note?: string;
  branchId?: string;
}

/* ─────────────────────────────── Outstanding ─────────────────────────────── */

export interface OpenInvoice {
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  date: string;
  /** What was left on credit at the time of sale, in paisa. */
  creditPaisa: number;
  receivedPaisa: number;
  outstandingPaisa: number;
  ageDays: number;
  bucket: AgeBucket;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function bucketOf(ageDays: number): AgeBucket {
  if (ageDays <= 30) return '0-30';
  if (ageDays <= 60) return '31-60';
  if (ageDays <= 90) return '61-90';
  return '90+';
}

/** The credit portion of an invoice — what the customer walked out owing. */
export function creditPortionPaisa(invoice: SaleInvoice): number {
  if (invoice.invoiceType !== 'TAX_INVOICE') return 0;
  const split = invoice.paymentSplit ?? [];
  if (split.length === 0) {
    return invoice.paymentMethod === 'Credit'
      ? roundMoney((invoice.netAmountDue ?? invoice.grandTotal) * 100)
      : 0;
  }
  return roundMoney(
    split.filter(e => e.mode === 'Credit').reduce((s, e) => s + (Number(e.amount) || 0), 0) * 100
  );
}

export function receivedAgainst(invoiceNumber: string, receipts: CustomerReceipt[]): number {
  return roundMoney(sumMoney(
    receipts.flatMap(r => r.allocations
      .filter(a => a.invoiceNumber === invoiceNumber)
      .map(a => a.amountPaisa))
  ));
}

export function openInvoices(
  invoices: SaleInvoice[],
  receipts: CustomerReceipt[],
  today: string = new Date().toISOString().slice(0, 10)
): OpenInvoice[] {
  return invoices
    .map(inv => {
      const creditPaisa = creditPortionPaisa(inv);
      const receivedPaisa = receivedAgainst(inv.invoiceNumber, receipts);
      const outstandingPaisa = roundMoney(creditPaisa - receivedPaisa);
      const ageDays = daysBetween(inv.date, today);
      return {
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        date: inv.date,
        creditPaisa,
        receivedPaisa,
        outstandingPaisa,
        ageDays,
        bucket: bucketOf(ageDays),
      };
    })
    .filter(r => r.outstandingPaisa > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Everything a customer currently owes — the figure the credit limit is checked against. */
export function customerExposure(
  customerId: string,
  invoices: SaleInvoice[],
  receipts: CustomerReceipt[],
  today?: string
): number {
  return roundMoney(sumMoney(
    openInvoices(invoices, receipts, today)
      .filter(r => r.customerId === customerId)
      .map(r => r.outstandingPaisa)
  ));
}

/* ─────────────────────────────── Credit limit ─────────────────────────────── */

export interface CreditCheck {
  allowed: boolean;
  exposurePaisa: number;
  limitPaisa: number;
  wouldBePaisa: number;
  message: string | null;
}

/**
 * Checks a proposed credit sale against the customer's limit.
 *
 * A customer with **no limit set is treated as having none**, not as unlimited — selling on credit
 * to someone nobody has assessed is the decision this check exists to surface. It refuses rather
 * than waving it through, and the refusal is overridable by a supervisor (M33), which is the right
 * shape: the shop can still do it, but someone senior owns the decision.
 */
export function checkCreditLimit(
  customer: Customer | null,
  proposedCreditPaisa: number,
  invoices: SaleInvoice[],
  receipts: CustomerReceipt[],
  today?: string
): CreditCheck {
  const limitPaisa = roundMoney((customer?.creditLimit ?? 0) * 100);
  const exposurePaisa = customer ? customerExposure(customer.id, invoices, receipts, today) : 0;
  const wouldBePaisa = roundMoney(exposurePaisa + proposedCreditPaisa);

  if (!customer) {
    return {
      allowed: false, exposurePaisa: 0, limitPaisa: 0, wouldBePaisa,
      message: 'Credit needs a named customer on the bill — a walk-in has nobody to collect from.',
    };
  }
  if (limitPaisa <= 0) {
    return {
      allowed: false, exposurePaisa, limitPaisa, wouldBePaisa,
      message: `${customer.name} has no credit limit set. Assess and set one, or take a supervisor's approval.`,
    };
  }
  if (wouldBePaisa > limitPaisa) {
    return {
      allowed: false, exposurePaisa, limitPaisa, wouldBePaisa,
      message: `This would take ${customer.name} to ₹${Math.round(wouldBePaisa / 100).toLocaleString('en-IN')} `
        + `against a limit of ₹${Math.round(limitPaisa / 100).toLocaleString('en-IN')}.`,
    };
  }
  return { allowed: true, exposurePaisa, limitPaisa, wouldBePaisa, message: null };
}

/* ─────────────────────────────── Receipts ─────────────────────────────── */

/**
 * Suggests oldest-first allocation. A *suggestion* — the stored allocation is whatever someone
 * confirmed, because a customer may well say "this one is for the bangle bill".
 */
export function suggestFifoAllocation(
  open: OpenInvoice[],
  amountPaisa: number
): ReceiptAllocation[] {
  const out: ReceiptAllocation[] = [];
  let left = roundMoney(amountPaisa);

  for (const inv of [...open].sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= 0) break;
    const take = Math.min(left, inv.outstandingPaisa);
    if (take > 0) {
      out.push({ invoiceNumber: inv.invoiceNumber, amountPaisa: roundMoney(take) });
      left = roundMoney(left - take);
    }
  }
  return out;
}

export function allocatedTotal(allocations: ReceiptAllocation[]): number {
  return roundMoney(sumMoney(allocations.map(a => a.amountPaisa)));
}

export function validateReceipt(
  amountPaisa: number,
  allocations: ReceiptAllocation[],
  open: OpenInvoice[],
  receivedBy: string
): string | null {
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) return 'Enter the amount received.';
  if (!receivedBy?.trim()) return 'Record who received the money.';
  if (allocations.length === 0) {
    // An unallocated receipt is exactly the "which bill did this settle?" problem.
    return 'Allocate the receipt against at least one bill.';
  }

  const total = allocatedTotal(allocations);
  if (total > roundMoney(amountPaisa)) {
    return `Allocated ₹${Math.round(total / 100).toLocaleString('en-IN')} against a receipt of `
      + `₹${Math.round(amountPaisa / 100).toLocaleString('en-IN')}.`;
  }

  for (const a of allocations) {
    const inv = open.find(o => o.invoiceNumber === a.invoiceNumber);
    if (!inv) return `${a.invoiceNumber} is not an open bill for this customer.`;
    if (a.amountPaisa > inv.outstandingPaisa) {
      return `${a.invoiceNumber} only has ₹${Math.round(inv.outstandingPaisa / 100).toLocaleString('en-IN')} outstanding.`;
    }
    if (a.amountPaisa <= 0) return `Allocation against ${a.invoiceNumber} must be positive.`;
  }

  // Money received but not allocated is an on-account balance we deliberately do not model yet;
  // saying so is better than silently swallowing it.
  if (total < roundMoney(amountPaisa)) {
    return 'Allocate the full receipt. Part-allocated money would sit on account, which this '
      + 'register does not track yet.';
  }
  return null;
}

export function buildReceipt(
  customer: { id: string; name: string },
  amountPaisa: number,
  mode: string,
  allocations: ReceiptAllocation[],
  receiptNumber: string,
  receivedBy: string,
  date: string = new Date().toISOString().slice(0, 10),
  branchId?: string
): CustomerReceipt {
  return {
    id: `rcpt-${Date.now()}`,
    receiptNumber,
    date,
    customerId: customer.id,
    customerName: customer.name,
    amountPaisa: roundMoney(amountPaisa),
    mode,
    allocations: allocations.map(a => ({ ...a, amountPaisa: roundMoney(a.amountPaisa) })),
    receivedBy: receivedBy.trim(),
    branchId,
  };
}

/* ─────────────────────────────── Ageing report ─────────────────────────────── */

export interface AgeingRow {
  bucket: AgeBucket;
  label: string;
  invoices: number;
  outstandingPaisa: number;
  sharePercent: number;
}

export function ageingSummary(open: OpenInvoice[]): AgeingRow[] {
  const total = roundMoney(sumMoney(open.map(o => o.outstandingPaisa)));
  return AGE_BUCKETS
    .map(bucket => {
      const rows = open.filter(o => o.bucket === bucket);
      const outstandingPaisa = roundMoney(sumMoney(rows.map(o => o.outstandingPaisa)));
      return {
        bucket,
        label: BUCKET_LABEL[bucket],
        invoices: rows.length,
        outstandingPaisa,
        sharePercent: total > 0 ? Math.round((outstandingPaisa / total) * 1000) / 10 : 0,
      };
    })
    .filter(r => r.invoices > 0);
}

export interface CustomerBalance {
  customerId: string;
  customerName: string;
  outstandingPaisa: number;
  oldestInvoiceDate: string;
  oldestAgeDays: number;
  invoices: number;
  limitPaisa: number;
  /** True when what they owe already exceeds what they were approved for. */
  overLimit: boolean;
}

export function customerBalances(
  open: OpenInvoice[],
  customers: Customer[]
): CustomerBalance[] {
  const ids = [...new Set(open.map(o => o.customerId).filter(Boolean))] as string[];

  return ids
    .map(id => {
      const rows = open.filter(o => o.customerId === id);
      const customer = customers.find(c => c.id === id);
      const outstandingPaisa = roundMoney(sumMoney(rows.map(r => r.outstandingPaisa)));
      const limitPaisa = roundMoney((customer?.creditLimit ?? 0) * 100);
      const oldest = rows.reduce((o, r) => (r.date < o.date ? r : o), rows[0]);
      return {
        customerId: id,
        customerName: customer?.name ?? rows[0].customerName,
        outstandingPaisa,
        oldestInvoiceDate: oldest.date,
        oldestAgeDays: oldest.ageDays,
        invoices: rows.length,
        limitPaisa,
        overLimit: limitPaisa > 0 && outstandingPaisa > limitPaisa,
      };
    })
    .sort((a, b) => b.outstandingPaisa - a.outstandingPaisa);
}

export interface ReceivablesSummary {
  totalOutstandingPaisa: number;
  openInvoices: number;
  customersOwing: number;
  overduePaisa: number;
  overLimitCustomers: number;
  /** Weighted by amount, so one big old bill is not hidden by many small fresh ones. */
  averageAgeDays: number;
}

export function summariseReceivables(
  open: OpenInvoice[],
  customers: Customer[],
  creditDays: number = DEFAULT_CREDIT_DAYS
): ReceivablesSummary {
  const total = roundMoney(sumMoney(open.map(o => o.outstandingPaisa)));
  const balances = customerBalances(open, customers);
  const weighted = open.reduce((s, o) => s + o.outstandingPaisa * o.ageDays, 0);

  return {
    totalOutstandingPaisa: total,
    openInvoices: open.length,
    customersOwing: balances.length,
    overduePaisa: roundMoney(sumMoney(
      open.filter(o => o.ageDays > creditDays).map(o => o.outstandingPaisa)
    )),
    overLimitCustomers: balances.filter(b => b.overLimit).length,
    averageAgeDays: total > 0 ? Math.round(weighted / total) : 0,
  };
}

export function nextReceiptNumber(existing: CustomerReceipt[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `RCPT-${year}-`;
  const highest = existing
    .filter(r => r.receiptNumber.startsWith(prefix))
    .reduce((max, r) => Math.max(max, Number(r.receiptNumber.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
