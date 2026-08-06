/**
 * Salesperson Attribution & Incentives (Milestone 58, PRD §3.4/§14.3).
 *
 * An invoice already records who *operated the till*. In a shop with floor staff that is often
 * not who *made the sale* — a salesperson spends an hour with a customer and the cashier bills it
 * in ninety seconds. Paying incentives off the biller's name pays the wrong person.
 *
 * ─── What is earned is snapshotted at sale time ───────────────────────────────────────
 * The tempting design is to store `salespersonId` and compute incentives on demand from whatever
 * scheme is current. That means changing the scheme in April silently rewrites what everyone
 * earned in March — and staff pay is not a figure that may quietly change after the fact.
 *
 * So the invoice carries a **frozen `SalesAttribution`**: who sold it, which scheme applied, its
 * basis and rate, and the rupee figure that produced. Re-running the calculation later cannot
 * alter a past payout, and a scheme change applies only from its effective date forward.
 *
 * ─── Incentives are earned on value the shop adds, not on the gold ────────────────────
 * The default basis is a percentage of **making charges and stone value** — never of metal value.
 * Metal value moves with the daily rate, so a percentage of it pays staff more when gold rises
 * without anyone selling better. The shop's margin lives in the making; that is what an incentive
 * scheme can afford to share. The same reasoning drives the loyalty engine (M59).
 *
 * ─── A return claws the incentive back ────────────────────────────────────────────────
 * A credit note carries a negative attribution against the original salesperson. Without it, a
 * salesperson is paid for a sale that was undone — and the obvious gaming is a sale in one period
 * returned in the next.
 */

import type { SaleInvoice } from '../types';
import { roundMoney, sumMoney } from './money';

export type IncentiveBasis = 'PERCENT_OF_MAKING' | 'PER_GRAM' | 'FLAT_PER_SALE';

export const BASIS_LABEL: Record<IncentiveBasis, string> = {
  PERCENT_OF_MAKING: 'Percentage of making + stones',
  PER_GRAM: 'Per gram sold',
  FLAT_PER_SALE: 'Flat per sale',
};

export const BASIS_NOTE: Record<IncentiveBasis, string> = {
  PERCENT_OF_MAKING:
    'Earned on the value the shop adds. Never on metal value — that moves with the rate, so a '
    + 'percentage of it pays more when gold rises without anyone selling better.',
  PER_GRAM: 'A fixed amount per gram sold. Simple, and blind to how well the piece was priced.',
  FLAT_PER_SALE: 'The same amount whatever the bill. Rewards closing, not size.',
};

export interface IncentiveScheme {
  id: string;
  name: string;
  basis: IncentiveBasis;
  /** Percent for PERCENT_OF_MAKING, paisa for PER_GRAM and FLAT_PER_SALE. */
  value: number;
  effectiveFrom: string;
  isActive: boolean;
}

export const DEFAULT_INCENTIVE_SCHEME: IncentiveScheme = {
  id: 'inc-default',
  name: 'Standard floor incentive',
  basis: 'PERCENT_OF_MAKING',
  value: 2,
  effectiveFrom: '2026-04-01',
  isActive: true,
};

/** Frozen onto the invoice. Nothing recomputes these figures later. */
export interface SalesAttribution {
  salespersonId: string;
  salespersonName: string;
  schemeId: string;
  schemeName: string;
  basis: IncentiveBasis;
  /** The rate that was in force, kept so the figure can be explained years later. */
  schemeValue: number;
  incentivePaisa: number;
}

/* ─────────────────────────────── Computing ─────────────────────────────── */

/** Making charges plus stone value across the bill — the part the shop actually added. */
export function valueAddedPaisa(invoice: SaleInvoice): number {
  return roundMoney(sumMoney(
    invoice.items.map(l => ((l.makingCharge || 0) + (l.stoneCharge || 0)) * 100)
  ));
}

export function netWeightGrams(invoice: SaleInvoice): number {
  return invoice.items.reduce((s, l) => s + (l.netWeight || 0), 0);
}

/**
 * The incentive an invoice earns under a scheme.
 *
 * A credit note produces a **negative** figure against the same basis, clawing back what the
 * original sale paid. Estimates earn nothing — a quotation is not a sale.
 */
export function computeIncentive(invoice: SaleInvoice, scheme: IncentiveScheme): number {
  if (invoice.invoiceType === 'ESTIMATE') return 0;
  const sign = invoice.invoiceType === 'CREDIT_NOTE' ? -1 : 1;

  switch (scheme.basis) {
    case 'PERCENT_OF_MAKING':
      return roundMoney(sign * (valueAddedPaisa(invoice) * scheme.value) / 100);
    case 'PER_GRAM':
      return roundMoney(sign * netWeightGrams(invoice) * scheme.value);
    case 'FLAT_PER_SALE':
      return roundMoney(sign * scheme.value);
    default:
      return 0;
  }
}

/** The scheme in force on a date. Append-only in spirit: a later scheme never rewrites an earlier sale. */
export function schemeInForce(
  schemes: IncentiveScheme[],
  onDate: string
): IncentiveScheme | null {
  const eligible = schemes
    .filter(s => s.isActive && s.effectiveFrom <= onDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return eligible[0] ?? null;
}

export function buildAttribution(
  invoice: SaleInvoice,
  salesperson: { id: string; name: string },
  scheme: IncentiveScheme
): SalesAttribution {
  return {
    salespersonId: salesperson.id,
    salespersonName: salesperson.name,
    schemeId: scheme.id,
    schemeName: scheme.name,
    basis: scheme.basis,
    schemeValue: scheme.value,
    incentivePaisa: computeIncentive(invoice, scheme),
  };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface SalespersonRow {
  salespersonId: string;
  salespersonName: string;
  sales: number;
  returns: number;
  netSalesPaisa: number;
  netWeightGrams: number;
  valueAddedPaisa: number;
  incentivePaisa: number;
  averageTicketPaisa: number;
}

function inPeriod(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/**
 * Built from the **stored** attributions, never recomputed from today's scheme. That is the whole
 * point of freezing them: this statement must read the same next year as it did on payday.
 */
export function salespersonStatement(
  invoices: SaleInvoice[],
  from?: string,
  to?: string
): SalespersonRow[] {
  const attributed = invoices.filter(
    i => i.salesAttribution && i.invoiceType !== 'ESTIMATE' && inPeriod(i.date, from, to)
  );
  const ids = [...new Set(attributed.map(i => i.salesAttribution!.salespersonId))];

  return ids
    .map(id => {
      const rows = attributed.filter(i => i.salesAttribution!.salespersonId === id);
      const sales = rows.filter(i => i.invoiceType === 'TAX_INVOICE');
      const returns = rows.filter(i => i.invoiceType === 'CREDIT_NOTE');
      const netSalesPaisa = roundMoney(sumMoney(rows.map(
        i => (i.invoiceType === 'CREDIT_NOTE' ? -1 : 1) * (i.grandTotal || 0) * 100
      )));
      const netWeight = rows.reduce(
        (s, i) => s + (i.invoiceType === 'CREDIT_NOTE' ? -1 : 1) * netWeightGrams(i), 0
      );

      return {
        salespersonId: id,
        salespersonName: rows[0].salesAttribution!.salespersonName,
        sales: sales.length,
        returns: returns.length,
        netSalesPaisa,
        netWeightGrams: Math.round(netWeight * 1000) / 1000,
        valueAddedPaisa: roundMoney(sumMoney(rows.map(
          i => (i.invoiceType === 'CREDIT_NOTE' ? -1 : 1) * valueAddedPaisa(i)
        ))),
        incentivePaisa: roundMoney(sumMoney(rows.map(i => i.salesAttribution!.incentivePaisa))),
        averageTicketPaisa: sales.length > 0
          ? roundMoney(sumMoney(sales.map(i => (i.grandTotal || 0) * 100)) / sales.length)
          : 0,
      };
    })
    .sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);
}

export interface AttributionSummary {
  attributedSales: number;
  unattributedSales: number;
  totalIncentivePaisa: number;
  clawedBackPaisa: number;
  topSellerName: string | null;
}

export function summariseAttribution(
  invoices: SaleInvoice[],
  from?: string,
  to?: string
): AttributionSummary {
  const fiscal = invoices.filter(
    i => i.invoiceType !== 'ESTIMATE' && inPeriod(i.date, from, to)
  );
  const attributed = fiscal.filter(i => i.salesAttribution);
  const rows = salespersonStatement(invoices, from, to);

  return {
    attributedSales: attributed.length,
    // Sales nobody is credited with. Worth surfacing: it is usually a process gap, not zero effort.
    unattributedSales: fiscal.length - attributed.length,
    totalIncentivePaisa: roundMoney(sumMoney(
      attributed.map(i => i.salesAttribution!.incentivePaisa)
    )),
    clawedBackPaisa: roundMoney(sumMoney(
      attributed
        .filter(i => i.invoiceType === 'CREDIT_NOTE')
        .map(i => i.salesAttribution!.incentivePaisa)
    )),
    topSellerName: rows[0]?.salespersonName ?? null,
  };
}

export function validateScheme(draft: Partial<IncentiveScheme>): string | null {
  if (!draft.name?.trim()) return 'Name the scheme — it is printed on every payout statement.';
  if (!draft.basis) return 'Choose what the incentive is earned on.';
  if (!Number.isFinite(draft.value) || (draft.value ?? 0) <= 0) {
    return 'Enter a rate above zero.';
  }
  if (draft.basis === 'PERCENT_OF_MAKING' && (draft.value ?? 0) > 100) {
    return 'A percentage of making charges cannot exceed 100%.';
  }
  if (!draft.effectiveFrom) {
    // Without a date, changing the scheme would silently restate past payouts.
    return 'Set the date this scheme takes effect. Past sales keep the scheme they were sold under.';
  }
  return null;
}
