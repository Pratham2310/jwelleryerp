import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INCENTIVE_SCHEME,
  BASIS_LABEL,
  valueAddedPaisa,
  netWeightGrams,
  computeIncentive,
  schemeInForce,
  buildAttribution,
  salespersonStatement,
  summariseAttribution,
  validateScheme,
  type IncentiveScheme,
} from './salesAttribution';
import type { SaleInvoice } from '../types';

const scheme = (over: Partial<IncentiveScheme> = {}): IncentiveScheme => ({
  ...DEFAULT_INCENTIVE_SCHEME, ...over,
});

const invoice = (over: Partial<SaleInvoice> = {}): SaleInvoice => ({
  id: 'i1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'MUM-2026-1', date: '2026-08-01',
  customerName: 'C', customerPhone: 'x',
  items: [{ name: 'Ring', netWeight: 10, makingCharge: 5000, stoneCharge: 2000, subtotal: 100000 }],
  oldGoldWeight: 0, oldGoldValue: 0, subtotal: 100000, tax: 3000, discount: 0,
  grandTotal: 103000, netAmountDue: 103000, paymentMethod: 'Cash',
  ...over,
} as SaleInvoice);

const attributed = (over: Partial<SaleInvoice> = {}) => {
  const inv = invoice(over);
  return { ...inv, salesAttribution: buildAttribution(inv, { id: 'u1', name: 'Rakesh T.' }, scheme()) };
};

describe('what an incentive is earned on', () => {
  it('counts making charges and stone value — the shop\'s own value add', () => {
    expect(valueAddedPaisa(invoice())).toBe(700000);   // ₹7,000 in paisa
  });

  it('EXCLUDES metal value entirely', () => {
    // A percentage of metal pays staff more when gold rises without anyone selling better.
    const dearer = invoice({ subtotal: 500000, grandTotal: 515000 });
    expect(valueAddedPaisa(dearer)).toBe(700000);
  });

  it('sums net weight across lines', () => {
    const two = invoice({ items: [
      { name: 'A', netWeight: 10, makingCharge: 0, stoneCharge: 0, subtotal: 1 },
      { name: 'B', netWeight: 5.5, makingCharge: 0, stoneCharge: 0, subtotal: 1 },
    ] } as Partial<SaleInvoice>);
    expect(netWeightGrams(two)).toBe(15.5);
  });
});

describe('computeIncentive', () => {
  it('pays a percentage of making and stones', () => {
    expect(computeIncentive(invoice(), scheme({ value: 2 }))).toBe(14000);   // 2% of ₹7,000
  });

  it('pays per gram', () => {
    expect(computeIncentive(invoice(), scheme({ basis: 'PER_GRAM', value: 500 }))).toBe(5000);
  });

  it('pays a flat amount per sale', () => {
    expect(computeIncentive(invoice(), scheme({ basis: 'FLAT_PER_SALE', value: 10000 }))).toBe(10000);
  });

  it('earns NOTHING on an estimate — a quotation is not a sale', () => {
    expect(computeIncentive(invoice({ invoiceType: 'ESTIMATE' }), scheme())).toBe(0);
  });

  it('CLAWS BACK on a credit note', () => {
    // Otherwise a salesperson is paid for a sale that was undone — and the obvious gaming is
    // a sale in one period returned in the next.
    expect(computeIncentive(invoice({ invoiceType: 'CREDIT_NOTE' }), scheme({ value: 2 }))).toBe(-14000);
  });

  it('claws back on every basis, not just the percentage one', () => {
    const cn = invoice({ invoiceType: 'CREDIT_NOTE' });
    expect(computeIncentive(cn, scheme({ basis: 'PER_GRAM', value: 500 }))).toBe(-5000);
    expect(computeIncentive(cn, scheme({ basis: 'FLAT_PER_SALE', value: 10000 }))).toBe(-10000);
  });
});

describe('schemeInForce', () => {
  const schemes = [
    scheme({ id: 'old', value: 2, effectiveFrom: '2026-04-01' }),
    scheme({ id: 'new', value: 3, effectiveFrom: '2026-07-01' }),
  ];

  it('picks the latest scheme effective on or before the date', () => {
    expect(schemeInForce(schemes, '2026-08-01')?.id).toBe('new');
    expect(schemeInForce(schemes, '2026-05-01')?.id).toBe('old');
  });

  it('ignores a scheme not yet effective', () => {
    expect(schemeInForce(schemes, '2026-03-01')).toBeNull();
  });

  it('ignores an inactive scheme', () => {
    const off = [scheme({ id: 'x', isActive: false, effectiveFrom: '2026-01-01' })];
    expect(schemeInForce(off, '2026-08-01')).toBeNull();
  });
});

describe('attribution is frozen at sale time', () => {
  it('records who sold it, under which scheme, at what rate', () => {
    const a = buildAttribution(invoice(), { id: 'u1', name: 'Rakesh T.' }, scheme({ value: 2 }));
    expect(a).toMatchObject({
      salespersonId: 'u1', salespersonName: 'Rakesh T.',
      basis: 'PERCENT_OF_MAKING', schemeValue: 2, incentivePaisa: 14000,
    });
  });

  it('a LATER scheme change cannot restate what was already earned', () => {
    // This is the whole reason the figure is stored rather than derived.
    const sold = attributed();
    const generous = scheme({ id: 'inc-2', value: 10, effectiveFrom: '2026-09-01' });
    expect(computeIncentive(sold, generous)).toBe(70000);        // what it WOULD pay now
    expect(sold.salesAttribution!.incentivePaisa).toBe(14000);   // what it actually paid
    expect(salespersonStatement([sold])[0].incentivePaisa).toBe(14000);
  });

  it('keeps the scheme name, so a payout can be explained years later', () => {
    expect(attributed().salesAttribution!.schemeName).toBe('Standard floor incentive');
  });
});

describe('salespersonStatement', () => {
  const rows = [
    attributed({ id: 'a', invoiceNumber: 'MUM-1' }),
    attributed({ id: 'b', invoiceNumber: 'MUM-2', grandTotal: 200000 }),
    attributed({ id: 'c', invoiceNumber: 'CN-1', invoiceType: 'CREDIT_NOTE' }),
  ];

  it('counts sales and returns separately', () => {
    const [r] = salespersonStatement(rows);
    expect(r.sales).toBe(2);
    expect(r.returns).toBe(1);
  });

  it('nets a return out of sales value and weight', () => {
    const [r] = salespersonStatement(rows);
    expect(r.netSalesPaisa).toBe((103000 + 200000 - 103000) * 100);
    expect(r.netWeightGrams).toBe(10);
  });

  it('nets the clawback out of the incentive', () => {
    const [r] = salespersonStatement(rows);
    expect(r.incentivePaisa).toBe(14000 + 14000 - 14000);
  });

  it('averages the ticket over sales only, not returns', () => {
    const [r] = salespersonStatement(rows);
    expect(r.averageTicketPaisa).toBe(Math.round((103000 + 200000) * 100 / 2));
  });

  it('EXCLUDES an estimate even when attributed', () => {
    const est = attributed({ id: 'e', invoiceType: 'ESTIMATE' });
    expect(salespersonStatement([est])).toHaveLength(0);
  });

  it('ignores invoices with no attribution rather than guessing', () => {
    expect(salespersonStatement([invoice()])).toHaveLength(0);
  });

  it('filters by period', () => {
    expect(salespersonStatement(rows, '2026-09-01', '2026-09-30')).toHaveLength(0);
  });

  it('ranks by net sales', () => {
    const other = invoice({ id: 'z', grandTotal: 900000 });
    const list = [...rows, { ...other, salesAttribution: buildAttribution(other, { id: 'u2', name: 'Sharda M.' }, scheme()) }];
    expect(salespersonStatement(list)[0].salespersonName).toBe('Sharda M.');
  });
});

describe('summariseAttribution', () => {
  const rows = [
    attributed({ id: 'a' }),
    attributed({ id: 'c', invoiceType: 'CREDIT_NOTE' }),
    invoice({ id: 'u', invoiceNumber: 'MUM-9' }),      // nobody credited
  ];

  it('surfaces sales nobody is credited with', () => {
    // Usually a process gap rather than zero effort, so it is worth showing.
    const s = summariseAttribution(rows);
    expect(s.attributedSales).toBe(2);
    expect(s.unattributedSales).toBe(1);
  });

  it('reports the net incentive and what was clawed back', () => {
    const s = summariseAttribution(rows);
    expect(s.totalIncentivePaisa).toBe(0);
    expect(s.clawedBackPaisa).toBe(-14000);
  });

  it('names the top seller', () => {
    expect(summariseAttribution(rows).topSellerName).toBe('Rakesh T.');
  });

  it('handles an empty book', () => {
    expect(summariseAttribution([])).toMatchObject({
      attributedSales: 0, unattributedSales: 0, topSellerName: null,
    });
  });
});

describe('validateScheme', () => {
  it('accepts the shipped default', () => {
    expect(validateScheme(DEFAULT_INCENTIVE_SCHEME)).toBeNull();
  });

  it('requires a name, a basis, a positive rate and an effective date', () => {
    expect(validateScheme(scheme({ name: ' ' }))).toMatch(/name the scheme/i);
    expect(validateScheme(scheme({ value: 0 }))).toMatch(/rate above zero/i);
    expect(validateScheme(scheme({ effectiveFrom: '' }))).toMatch(/past sales keep the scheme/i);
  });

  it('refuses a percentage above 100', () => {
    expect(validateScheme(scheme({ value: 150 }))).toMatch(/cannot exceed 100/i);
  });

  it('allows a large per-gram figure, which is paisa not percent', () => {
    expect(validateScheme(scheme({ basis: 'PER_GRAM', value: 5000 }))).toBeNull();
  });

  it('labels every basis', () => {
    expect(Object.keys(BASIS_LABEL)).toHaveLength(3);
  });
});
