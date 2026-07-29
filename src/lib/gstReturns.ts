/**
 * GSTR-1 / GSTR-3B preview and CSV export (PRD §9.6, Milestone 23).
 *
 * Read-only derivations from the invoice register — nothing here mutates state, and there is
 * no filing API (simulation ground rule, `.ai/IMPLEMENTATION_WORKFLOW.md`). The point is that
 * the numbers reconcile: the export must equal the sum of the underlying invoices for the
 * period, which is the milestone's own acceptance criterion and the first thing an accountant
 * checks against the books.
 *
 * Three domain rules drive everything below and are easy to get wrong:
 *
 *  1. An ESTIMATE is a quotation, not a supply. It never appears in a return. Including one
 *     would overstate output tax and create a liability the shop does not owe.
 *  2. A CREDIT_NOTE carries negative figures throughout this app (Milestone 12), so summing it
 *     alongside invoices yields net-of-returns automatically. GSTR-1 nonetheless reports credit
 *     notes in their OWN table (CDNR/CDNUR) with positive magnitudes, because the return asks
 *     "what did you credit", not "what is your net". Both views come from the same records.
 *  3. B2B vs B2C is decided by whether the buyer has a GSTIN, not by transaction size. A
 *     registered buyer's invoice must be reported line-by-line so they can claim input credit;
 *     misfiling it as B2C silently denies them that credit.
 */

import type { SaleInvoice, TaxRate } from '../types';
import { summariseByHsn, type HsnSummaryRow } from './taxMaster';

/** A return period, as 'YYYY-MM'. GST returns are filed monthly. */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[Number(m) - 1] ?? m} ${y}`;
}

/** Every period that has at least one fiscal document, newest first. */
export function availablePeriods(invoices: SaleInvoice[]): string[] {
  const periods = new Set(
    invoices.filter(isReportable).map(inv => periodOf(inv.date))
  );
  return [...periods].sort().reverse();
}

/** Only real supplies reach a return. See rule 1 in the module header. */
export function isReportable(invoice: SaleInvoice): boolean {
  return invoice.invoiceType === 'TAX_INVOICE' || invoice.invoiceType === 'CREDIT_NOTE';
}

export function filterByPeriod(invoices: SaleInvoice[], period: string): SaleInvoice[] {
  return invoices.filter(inv => isReportable(inv) && periodOf(inv.date) === period);
}

/**
 * Tax components for an invoice, falling back for documents raised before Milestone 21 which
 * carry only a combined `tax`. Those are treated as intra-state, which is what they were:
 * the CGST/SGST split did not exist yet and every sale was to the shop's own state.
 */
function componentsOf(inv: SaleInvoice): { cgst: number; sgst: number; igst: number } {
  if (inv.cgst !== undefined || inv.sgst !== undefined || inv.igst !== undefined) {
    return { cgst: inv.cgst ?? 0, sgst: inv.sgst ?? 0, igst: inv.igst ?? 0 };
  }
  const half = inv.tax / 2;
  return { cgst: Math.round(half), sgst: inv.tax - Math.round(half), igst: 0 };
}

/** Taxable value actually charged, i.e. after discount (PRD §7.4). */
function taxableOf(inv: SaleInvoice): number {
  return inv.subtotal - inv.discount;
}

export interface B2BRow {
  gstin: string;
  customerName: string;
  invoiceNumber: string;
  date: string;
  invoiceValue: number;
  placeOfSupply: string;
  ratePercent: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/** GSTR-1 Table 4A — supplies to registered persons, reported invoice by invoice. */
export function buildB2B(invoices: SaleInvoice[], customerGstinOf: (inv: SaleInvoice) => string | undefined): B2BRow[] {
  return invoices
    .filter(inv => inv.invoiceType === 'TAX_INVOICE' && customerGstinOf(inv))
    .map(inv => {
      const c = componentsOf(inv);
      return {
        gstin: customerGstinOf(inv)!,
        customerName: inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        invoiceValue: inv.grandTotal,
        placeOfSupply: inv.placeOfSupplyStateCode ?? '',
        ratePercent: inv.items[0]?.gstRatePercent ?? 3,
        taxableValue: taxableOf(inv),
        ...c,
      };
    })
    .sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
}

export interface B2CSRow {
  placeOfSupply: string;
  ratePercent: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoiceCount: number;
}

/**
 * GSTR-1 Table 7 — B2C (small) supplies, consolidated by place of supply and rate rather than
 * listed individually. This is the bulk of a jewellery retailer's return.
 */
export function buildB2CS(
  invoices: SaleInvoice[],
  customerGstinOf: (inv: SaleInvoice) => string | undefined,
  homeStateCode: string
): B2CSRow[] {
  const grouped = new Map<string, B2CSRow>();

  for (const inv of invoices) {
    if (inv.invoiceType !== 'TAX_INVOICE' || customerGstinOf(inv)) continue;
    const pos = inv.placeOfSupplyStateCode || homeStateCode;
    const rate = inv.items[0]?.gstRatePercent ?? 3;
    const key = `${pos}|${rate}`;
    const c = componentsOf(inv);
    const existing = grouped.get(key);

    if (existing) {
      existing.taxableValue += taxableOf(inv);
      existing.cgst += c.cgst;
      existing.sgst += c.sgst;
      existing.igst += c.igst;
      existing.invoiceCount += 1;
    } else {
      grouped.set(key, {
        placeOfSupply: pos,
        ratePercent: rate,
        taxableValue: taxableOf(inv),
        ...c,
        invoiceCount: 1,
      });
    }
  }

  return [...grouped.values()].sort(
    (a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.ratePercent - b.ratePercent
  );
}

export interface CreditNoteRow {
  noteNumber: string;
  date: string;
  againstInvoice: string;
  againstInvoiceDate: string;
  customerName: string;
  gstin?: string;
  noteValue: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * GSTR-1 Tables 9B (CDNR/CDNUR) — credit notes.
 *
 * Reported as POSITIVE magnitudes even though the stored records are negative: the return asks
 * how much was credited, and the portal applies the sign itself. Filing these as negative
 * would double-subtract them.
 */
export function buildCreditNotes(
  invoices: SaleInvoice[],
  customerGstinOf: (inv: SaleInvoice) => string | undefined
): CreditNoteRow[] {
  return invoices
    .filter(inv => inv.invoiceType === 'CREDIT_NOTE')
    .map(inv => {
      const c = componentsOf(inv);
      return {
        noteNumber: inv.invoiceNumber,
        date: inv.date,
        againstInvoice: inv.creditNoteAgainstInvoice ?? '',
        againstInvoiceDate: inv.creditNoteAgainstInvoiceDate ?? '',
        customerName: inv.customerName,
        gstin: customerGstinOf(inv),
        noteValue: Math.abs(inv.grandTotal),
        taxableValue: Math.abs(taxableOf(inv)),
        cgst: Math.abs(c.cgst),
        sgst: Math.abs(c.sgst),
        igst: Math.abs(c.igst),
      };
    })
    .sort((a, b) => a.noteNumber.localeCompare(b.noteNumber));
}

/** GSTR-1 Table 12 — HSN-wise summary of outward supplies. */
export function buildHsnSummary(invoices: SaleInvoice[], taxRates: TaxRate[] = []): HsnSummaryRow[] {
  const lines = invoices.flatMap(inv => {
    const c = componentsOf(inv);
    const invoiceTaxable = taxableOf(inv);
    // Apportion the bill-level tax across lines by their share of the taxable value, so an
    // invoice with a bill-level discount still reconciles line-to-total.
    const lineTotal = inv.items.reduce((s, i) => s + i.subtotal, 0) || 1;
    return inv.items.map(item => {
      const share = item.subtotal / lineTotal;
      return {
        hsnCode: item.hsnCode,
        ratePercent: item.gstRatePercent,
        taxableValue: Math.round(invoiceTaxable * share),
        cgst: Math.round(c.cgst * share),
        sgst: Math.round(c.sgst * share),
        igst: Math.round(c.igst * share),
      };
    });
  });
  return summariseByHsn(lines, taxRates);
}

export interface Gstr3bSummary {
  /** 3.1(a) — outward taxable supplies, other than zero-rated/nil/exempted. */
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  /** Documents behind the figures, for the reconciliation line. */
  invoiceCount: number;
  creditNoteCount: number;
}

/**
 * GSTR-3B table 3.1(a). Net of credit notes, which is what 3.1(a) reports — unlike GSTR-1,
 * the summary return nets returns against outward supplies rather than tabling them apart.
 */
export function buildGstr3b(invoices: SaleInvoice[]): Gstr3bSummary {
  let taxableValue = 0, cgst = 0, sgst = 0, igst = 0, invoiceCount = 0, creditNoteCount = 0;

  for (const inv of invoices) {
    const c = componentsOf(inv);
    // Stored credit notes are already negative, so a plain sum nets them (rule 2).
    taxableValue += taxableOf(inv);
    cgst += c.cgst;
    sgst += c.sgst;
    igst += c.igst;
    if (inv.invoiceType === 'CREDIT_NOTE') creditNoteCount += 1;
    else invoiceCount += 1;
  }

  return {
    taxableValue,
    cgst,
    sgst,
    igst,
    totalTax: cgst + sgst + igst,
    invoiceCount,
    creditNoteCount,
  };
}

/**
 * Cross-check that the return ties back to the register (the milestone's acceptance criterion).
 * `taxDifference` must be zero; a non-zero value means a document's components disagree with
 * its own `tax` field and the return would not reconcile against the books.
 */
export interface ReconciliationCheck {
  registerTax: number;
  returnTax: number;
  taxDifference: number;
  registerTaxable: number;
  returnTaxable: number;
  taxableDifference: number;
  balanced: boolean;
}

export function reconcile(invoices: SaleInvoice[], summary: Gstr3bSummary): ReconciliationCheck {
  const registerTax = invoices.reduce((s, inv) => s + inv.tax, 0);
  const registerTaxable = invoices.reduce((s, inv) => s + taxableOf(inv), 0);
  const taxDifference = registerTax - summary.totalTax;
  const taxableDifference = registerTaxable - summary.taxableValue;
  return {
    registerTax,
    returnTax: summary.totalTax,
    taxDifference,
    registerTaxable,
    returnTaxable: summary.taxableValue,
    taxableDifference,
    balanced: taxDifference === 0 && taxableDifference === 0,
  };
}

/* ────────────────────────────── CSV export ────────────────────────────── */

/**
 * Escapes a CSV field. Customer names contain commas and quotes often enough that skipping
 * this silently shifts every following column — which an accountant would only notice after
 * the numbers stopped adding up.
 */
export function csvCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | undefined)[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

export interface Gstr1Tables {
  b2b: B2BRow[];
  b2cs: B2CSRow[];
  creditNotes: CreditNoteRow[];
  hsn: HsnSummaryRow[];
}

/** One CSV containing every GSTR-1 table, section by section, as the offline utility expects. */
export function gstr1Csv(tables: Gstr1Tables, period: string, gstin: string): string {
  const rows: (string | number | undefined)[][] = [
    ['GSTR-1', periodLabel(period), `GSTIN: ${gstin}`],
    [],
    ['4A - B2B Invoices'],
    ['GSTIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
    ...tables.b2b.map(r => [r.gstin, r.customerName, r.invoiceNumber, r.date, r.invoiceValue, r.placeOfSupply, r.ratePercent, r.taxableValue, r.cgst, r.sgst, r.igst]),
    [],
    ['7 - B2C (Small) Consolidated'],
    ['Place of Supply', 'Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Invoice Count'],
    ...tables.b2cs.map(r => [r.placeOfSupply, r.ratePercent, r.taxableValue, r.cgst, r.sgst, r.igst, r.invoiceCount]),
    [],
    ['9B - Credit Notes'],
    ['Note Number', 'Note Date', 'Against Invoice', 'Invoice Date', 'Receiver Name', 'GSTIN', 'Note Value', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
    ...tables.creditNotes.map(r => [r.noteNumber, r.date, r.againstInvoice, r.againstInvoiceDate, r.customerName, r.gstin, r.noteValue, r.taxableValue, r.cgst, r.sgst, r.igst]),
    [],
    ['12 - HSN Summary'],
    ['HSN', 'Description', 'Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
    ...tables.hsn.map(r => [r.hsnCode, r.description, r.ratePercent, r.taxableValue, r.cgst, r.sgst, r.igst]),
  ];
  return toCsv(rows);
}

export function gstr3bCsv(summary: Gstr3bSummary, period: string, gstin: string): string {
  return toCsv([
    ['GSTR-3B', periodLabel(period), `GSTIN: ${gstin}`],
    [],
    ['3.1 - Details of Outward Supplies'],
    ['Nature of Supply', 'Total Taxable Value', 'IGST', 'CGST', 'SGST'],
    ['(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      summary.taxableValue, summary.igst, summary.cgst, summary.sgst],
    [],
    ['Total Tax Payable', summary.totalTax],
    ['Documents', `${summary.invoiceCount} invoice(s), ${summary.creditNoteCount} credit note(s)`],
  ]);
}

/** Triggers a client-side download. Kept here so the component stays declarative. */
export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens the rupee figures and any Devanagari names in UTF-8.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
