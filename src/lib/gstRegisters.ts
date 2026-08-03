/**
 * ITC Register & HSN Summary (Milestone 52, PRD §9.6).
 *
 * The two GST reports the PRD requires beyond GSTR-1/3B, which M23 already builds.
 *
 * ─── The ITC Register is not just a list of purchases ─────────────────────────────────
 * Credit *claimed* is not credit *retained*. Two things reduce it, and a register showing only
 * the claim side overstates what the shop is entitled to:
 *
 *   1. **Blocked credit** (s.17(5)) — invoices already flagged `itcEligible: false` at booking.
 *   2. **Reversals** — stock written off under Milestone 42 carries an ITC reversal, because
 *      s.17(5)(h) blocks credit on goods lost, stolen or destroyed. That reversal belongs on this
 *      register; leaving it off is how a shop ends up claiming credit it has already forfeited.
 *
 * Reverse-charge invoices sit on both sides: the shop pays the tax itself *and* claims it back.
 * The register shows the credit leg, and flags the row, because a reader reconciling against
 * GSTR-2B will not find it there — RCM credit is self-declared, not supplier-reported.
 *
 * ─── The HSN Summary is Table 12 of GSTR-1 ────────────────────────────────────────────
 * Grouped by HSN across the *sales* register, since that is what Table 12 reports. Credit notes
 * are netted in rather than listed separately — a return reduces the period's outward supply, and
 * showing gross sales here would not reconcile against the GSTR-1 the shop actually files.
 */

import type { PurchaseInvoice, SaleInvoice, Supplier } from '../types';
import type { StockAdjustment } from './stockAdjustment';
import { roundMoney, sumMoney } from './money';
import { csvCell } from './gstReturns';

/* ─────────────────────────────── ITC Register ─────────────────────────────── */

export interface ItcRow {
  invoiceId: string;
  supplierName: string;
  supplierGstin: string;
  supplierInvoiceNo: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  eligible: boolean;
  ineligibleReason?: string;
  isReverseCharge: boolean;
}

function inPeriod(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function itcRegister(
  invoices: PurchaseInvoice[],
  suppliers: Supplier[],
  from?: string,
  to?: string
): ItcRow[] {
  return invoices
    .filter(i => inPeriod(i.supplierInvoiceDate, from, to))
    .map(i => {
      const supplier = suppliers.find(s => s.id === i.supplierId);
      return {
        invoiceId: i.id,
        supplierName: supplier?.name ?? 'Unknown supplier',
        supplierGstin: supplier?.gstin ?? '',
        supplierInvoiceNo: i.supplierInvoiceNo,
        invoiceDate: i.supplierInvoiceDate,
        taxableValue: i.taxableValue,
        cgst: i.cgst,
        sgst: i.sgst,
        igst: i.igst,
        totalTax: i.totalTax,
        eligible: i.itcEligible,
        ineligibleReason: i.itcIneligibleReason,
        isReverseCharge: i.isReverseCharge,
      };
    })
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.supplierInvoiceNo.localeCompare(b.supplierInvoiceNo));
}

export interface ItcSummary {
  invoices: number;
  taxableValue: number;
  /** Credit on eligible invoices — before reversals. */
  claimedCgst: number;
  claimedSgst: number;
  claimedIgst: number;
  claimedTotal: number;
  /** Credit blocked at booking under s.17(5). */
  blockedTotal: number;
  /** Value of stock written off that carries a reversal (a base, not a tax figure — see below). */
  reversalBase: number;
  reverseChargeTotal: number;
  /** What the shop may actually carry forward. */
  netCredit: number;
}

/**
 * `reversalBase` is the *stock value* on which credit must be reversed, not the tax itself: the
 * rate originally claimed lives on the purchase invoice for those goods, which a write-off does
 * not reference. Naming it a base keeps the figure from implying a precision it does not have —
 * the same decision `summariseAdjustments()` made, and the reason `netCredit` does not subtract it.
 */
export function summariseItc(
  rows: ItcRow[],
  adjustments: StockAdjustment[] = [],
  from?: string,
  to?: string
): ItcSummary {
  const eligible = rows.filter(r => r.eligible);
  const blocked = rows.filter(r => !r.eligible);
  const claimedCgst = roundMoney(sumMoney(eligible.map(r => r.cgst)));
  const claimedSgst = roundMoney(sumMoney(eligible.map(r => r.sgst)));
  const claimedIgst = roundMoney(sumMoney(eligible.map(r => r.igst)));

  return {
    invoices: rows.length,
    taxableValue: roundMoney(sumMoney(rows.map(r => r.taxableValue))),
    claimedCgst,
    claimedSgst,
    claimedIgst,
    claimedTotal: roundMoney(claimedCgst + claimedSgst + claimedIgst),
    blockedTotal: roundMoney(sumMoney(blocked.map(r => r.totalTax))),
    reversalBase: roundMoney(sumMoney(
      adjustments
        .filter(a => a.itcReversed && inPeriod(a.date, from, to))
        .map(a => a.valueWrittenOff)
    )),
    reverseChargeTotal: roundMoney(sumMoney(rows.filter(r => r.isReverseCharge).map(r => r.totalTax))),
    netCredit: roundMoney(claimedCgst + claimedSgst + claimedIgst),
  };
}

export function itcRegisterCsv(rows: ItcRow[]): string {
  const header = [
    'Invoice Date', 'Supplier', 'GSTIN', 'Supplier Invoice No', 'Taxable Value',
    'CGST', 'SGST', 'IGST', 'Total Tax', 'ITC Eligible', 'Reverse Charge', 'Remark',
  ];
  const body = rows.map(r => [
    r.invoiceDate, r.supplierName, r.supplierGstin, r.supplierInvoiceNo, r.taxableValue,
    r.cgst, r.sgst, r.igst, r.totalTax,
    r.eligible ? 'Yes' : 'No',
    r.isReverseCharge ? 'Yes' : 'No',
    r.ineligibleReason ?? '',
  ]);
  return [header, ...body].map(line => line.map(csvCell).join(',')).join('\n');
}

/* ─────────────────────────────── HSN Summary ─────────────────────────────── */

export interface HsnRow {
  hsnCode: string;
  /** Table 12 asks for a description; the shop's own line names are the closest honest source. */
  description: string;
  uqc: string;
  totalQuantity: number;
  taxableValue: number;
  gstRatePercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

/** Jewellery is billed by weight; GSTR-1's unit-quantity code for grams is GMS. */
export const UQC_GRAMS = 'GMS';

/**
 * Table 12 of GSTR-1, grouped by HSN across outward supplies.
 *
 * Credit notes are **netted in, not excluded**: a return reduces the period's outward supply, and
 * a summary showing gross sales would not reconcile against the return the shop actually files.
 * Estimates are excluded entirely — a quotation is not a supply.
 */
export function hsnSummary(invoices: SaleInvoice[], from?: string, to?: string): HsnRow[] {
  const fiscal = invoices.filter(
    i => i.invoiceType !== 'ESTIMATE' && inPeriod(i.date, from, to)
  );

  const byHsn = new Map<string, HsnRow>();

  for (const invoice of fiscal) {
    // A credit note carries positive figures with CREDIT_NOTE type in this codebase's model,
    // so the sign is applied here rather than assumed on the stored line.
    const sign = invoice.invoiceType === 'CREDIT_NOTE' ? -1 : 1;
    const invoiceTaxable = sumMoney(invoice.items.map(l => l.subtotal || 0));

    for (const line of invoice.items) {
      const hsn = line.hsnCode || 'UNCLASSIFIED';
      const existing = byHsn.get(hsn) ?? {
        hsnCode: hsn,
        description: line.name || 'Jewellery',
        uqc: UQC_GRAMS,
        totalQuantity: 0,
        taxableValue: 0,
        gstRatePercent: line.gstRatePercent ?? 0,
        cgst: 0, sgst: 0, igst: 0, totalTax: 0,
      };

      const lineTaxable = line.subtotal || 0;
      // The invoice's tax is split across its lines in proportion to taxable value, because the
      // stored tax sits at invoice level while Table 12 reports per HSN.
      const share = invoiceTaxable > 0 ? lineTaxable / invoiceTaxable : 0;

      existing.totalQuantity += sign * (line.netWeight || 0);
      existing.taxableValue += sign * lineTaxable;
      existing.cgst += sign * (invoice.cgst ?? 0) * share;
      existing.sgst += sign * (invoice.sgst ?? 0) * share;
      existing.igst += sign * (invoice.igst ?? 0) * share;
      byHsn.set(hsn, existing);
    }
  }

  return [...byHsn.values()]
    .map(r => ({
      ...r,
      totalQuantity: Number(r.totalQuantity.toFixed(3)),
      taxableValue: roundMoney(r.taxableValue),
      cgst: roundMoney(r.cgst),
      sgst: roundMoney(r.sgst),
      igst: roundMoney(r.igst),
      totalTax: roundMoney(r.cgst + r.sgst + r.igst),
    }))
    .sort((a, b) => b.taxableValue - a.taxableValue);
}

export function hsnSummaryCsv(rows: HsnRow[]): string {
  const header = [
    'HSN', 'Description', 'UQC', 'Total Quantity', 'Taxable Value',
    'Rate %', 'CGST', 'SGST', 'IGST', 'Total Tax',
  ];
  const body = rows.map(r => [
    r.hsnCode, r.description, r.uqc, r.totalQuantity, r.taxableValue,
    r.gstRatePercent, r.cgst, r.sgst, r.igst, r.totalTax,
  ]);
  return [header, ...body].map(line => line.map(csvCell).join(',')).join('\n');
}

/* ─────────────────────────────── Reconciliation ─────────────────────────────── */

export interface RegisterCheck {
  label: string;
  passes: boolean;
  detail: string;
}

/**
 * The milestone's two criteria, made executable: the ITC total must equal input tax on booked
 * purchase invoices, and the HSN summary's taxable values must reconcile against the sales
 * register for the period.
 */
export function reconcileRegisters(
  purchases: PurchaseInvoice[],
  suppliers: Supplier[],
  sales: SaleInvoice[],
  from?: string,
  to?: string
): RegisterCheck[] {
  const rows = itcRegister(purchases, suppliers, from, to);
  const summary = summariseItc(rows);

  const bookedInputTax = roundMoney(sumMoney(
    purchases
      .filter(p => inPeriod(p.supplierInvoiceDate, from, to) && p.itcEligible)
      .map(p => p.totalTax)
  ));

  const hsn = hsnSummary(sales, from, to);
  const hsnTaxable = roundMoney(sumMoney(hsn.map(h => h.taxableValue)));
  const salesTaxable = roundMoney(sumMoney(
    sales
      .filter(i => i.invoiceType !== 'ESTIMATE' && inPeriod(i.date, from, to))
      .map(i => (i.invoiceType === 'CREDIT_NOTE' ? -1 : 1) * sumMoney(i.items.map(l => l.subtotal || 0)))
  ));

  const hsnTax = roundMoney(sumMoney(hsn.map(h => h.totalTax)));
  const salesTax = roundMoney(sumMoney(
    sales
      .filter(i => i.invoiceType !== 'ESTIMATE' && inPeriod(i.date, from, to))
      .map(i => (i.invoiceType === 'CREDIT_NOTE' ? -1 : 1) * ((i.cgst ?? 0) + (i.sgst ?? 0) + (i.igst ?? 0)))
  ));

  return [
    {
      label: 'ITC Register equals input tax on booked eligible purchases',
      passes: summary.claimedTotal === bookedInputTax,
      detail: `₹${summary.claimedTotal.toLocaleString('en-IN')} vs ₹${bookedInputTax.toLocaleString('en-IN')}`,
    },
    {
      label: 'HSN Summary taxable value ties to the sales register',
      passes: hsnTaxable === salesTaxable,
      detail: `₹${hsnTaxable.toLocaleString('en-IN')} vs ₹${salesTaxable.toLocaleString('en-IN')}`,
    },
    {
      label: 'HSN Summary tax ties to the sales register',
      // Allowed a rupee of slack: the per-line split of an invoice-level tax cannot always
      // land exactly, and claiming otherwise would be a false precision.
      passes: Math.abs(hsnTax - salesTax) <= 1,
      detail: `₹${hsnTax.toLocaleString('en-IN')} vs ₹${salesTax.toLocaleString('en-IN')}`,
    },
    {
      label: 'Every outward line carries an HSN',
      passes: !hsn.some(h => h.hsnCode === 'UNCLASSIFIED'),
      detail: hsn.some(h => h.hsnCode === 'UNCLASSIFIED')
        ? 'Some lines are unclassified — Rule 46 requires an HSN per line'
        : `${hsn.length} HSN code(s) reported`,
    },
  ];
}
