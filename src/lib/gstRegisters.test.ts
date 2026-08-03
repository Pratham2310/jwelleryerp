import { describe, it, expect } from 'vitest';
import {
  itcRegister,
  summariseItc,
  itcRegisterCsv,
  hsnSummary,
  hsnSummaryCsv,
  reconcileRegisters,
  UQC_GRAMS,
} from './gstRegisters';
import type { PurchaseInvoice, SaleInvoice, Supplier } from '../types';
import type { StockAdjustment } from './stockAdjustment';

const supplier = (over: Partial<Supplier> = {}): Supplier => ({
  id: 's1', name: 'Rajesh Bullion', gstin: '27AAAAA0000A1Z5', stateCode: '27',
  ...over,
} as Supplier);

const purchase = (over: Partial<PurchaseInvoice> = {}): PurchaseInvoice => ({
  id: 'p1', internalRef: 'PINV-1', supplierId: 's1', supplierInvoiceNo: 'RB/001',
  supplierInvoiceDate: '2026-07-10', taxableValue: 100000, gstRatePercent: 3,
  isReverseCharge: false, cgst: 1500, sgst: 1500, igst: 0, totalTax: 3000,
  invoiceTotal: 103000, itcEligible: true, postedOn: '2026-07-10',
  ...over,
} as PurchaseInvoice);

const sale = (over: Partial<SaleInvoice> = {}): SaleInvoice => ({
  id: 'i1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'MUM-1', date: '2026-07-15',
  customerName: 'C', customerPhone: 'x',
  items: [{ name: 'Ring', netWeight: 10, subtotal: 100000, hsnCode: '7113', gstRatePercent: 3 }],
  oldGoldWeight: 0, oldGoldValue: 0, subtotal: 100000, tax: 3000, discount: 0,
  grandTotal: 103000, netAmountDue: 103000, cgst: 1500, sgst: 1500, igst: 0,
  paymentMethod: 'Cash',
  ...over,
} as SaleInvoice);

const suppliers = [supplier()];

describe('itcRegister', () => {
  it('resolves the supplier and their GSTIN onto each row', () => {
    const [row] = itcRegister([purchase()], suppliers);
    expect(row.supplierName).toBe('Rajesh Bullion');
    expect(row.supplierGstin).toBe('27AAAAA0000A1Z5');
  });

  it('names an unknown supplier rather than showing a blank row', () => {
    expect(itcRegister([purchase({ supplierId: 'ghost' })], suppliers)[0].supplierName)
      .toBe('Unknown supplier');
  });

  it('filters by period', () => {
    const rows = itcRegister(
      [purchase(), purchase({ id: 'p2', supplierInvoiceDate: '2026-06-01' })],
      suppliers, '2026-07-01', '2026-07-31'
    );
    expect(rows).toHaveLength(1);
  });

  it('sorts oldest first, the order a register is read in', () => {
    const rows = itcRegister([
      purchase({ id: 'p2', supplierInvoiceDate: '2026-07-20', supplierInvoiceNo: 'B' }),
      purchase({ id: 'p1', supplierInvoiceDate: '2026-07-05', supplierInvoiceNo: 'A' }),
    ], suppliers);
    expect(rows.map(r => r.supplierInvoiceNo)).toEqual(['A', 'B']);
  });
});

describe('summariseItc — claimed is not retained', () => {
  it('totals credit on eligible invoices', () => {
    const s = summariseItc(itcRegister([purchase()], suppliers));
    expect(s.claimedTotal).toBe(3000);
    expect(s.netCredit).toBe(3000);
  });

  it('EXCLUDES blocked credit from the claim, and reports it separately', () => {
    const rows = itcRegister([
      purchase(),
      purchase({ id: 'p2', supplierInvoiceNo: 'RB/002', itcEligible: false, itcIneligibleReason: 'Blocked u/s 17(5)' }),
    ], suppliers);
    const s = summariseItc(rows);
    expect(s.claimedTotal).toBe(3000);
    expect(s.blockedTotal).toBe(3000);
  });

  it('reports reverse-charge tax separately — GSTR-2B will not show it', () => {
    const rows = itcRegister([purchase({ isReverseCharge: true })], suppliers);
    expect(summariseItc(rows).reverseChargeTotal).toBe(3000);
  });

  it('carries write-off reversals from Milestone 42 onto the register', () => {
    // s.17(5)(h): credit on goods destroyed must be reversed. Leaving it off this register is
    // how a shop ends up claiming credit it has already forfeited.
    const adjustments = [
      { date: '2026-07-20', itcReversed: true, valueWrittenOff: 50000 },
      { date: '2026-07-21', itcReversed: false, valueWrittenOff: 90000 },
    ] as StockAdjustment[];
    const s = summariseItc(itcRegister([purchase()], suppliers), adjustments);
    expect(s.reversalBase).toBe(50000);
  });

  it('respects the period when totalling reversals', () => {
    const adjustments = [{ date: '2026-06-01', itcReversed: true, valueWrittenOff: 50000 }] as StockAdjustment[];
    expect(summariseItc(itcRegister([purchase()], suppliers), adjustments, '2026-07-01', '2026-07-31').reversalBase)
      .toBe(0);
  });

  it('summarises an empty register', () => {
    expect(summariseItc([])).toMatchObject({ invoices: 0, claimedTotal: 0, netCredit: 0 });
  });
});

describe('itcRegisterCsv', () => {
  it('has a header and one row per invoice', () => {
    const csv = itcRegisterCsv(itcRegister([purchase()], suppliers));
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('Supplier Invoice No');
  });

  it('escapes a supplier name containing a comma', () => {
    const csv = itcRegisterCsv(itcRegister([purchase()], [supplier({ name: 'Rajesh, Bullion & Co' })]));
    expect(csv).toContain('"Rajesh, Bullion & Co"');
  });
});

describe('hsnSummary — GSTR-1 Table 12', () => {
  it('groups by HSN with a unit-quantity code', () => {
    const [row] = hsnSummary([sale()]);
    expect(row.hsnCode).toBe('7113');
    expect(row.uqc).toBe(UQC_GRAMS);
    expect(row.taxableValue).toBe(100000);
    expect(row.totalQuantity).toBe(10);
  });

  it('EXCLUDES estimates — a quotation is not a supply', () => {
    expect(hsnSummary([sale({ id: 'e1', invoiceType: 'ESTIMATE' })])).toHaveLength(0);
  });

  it('NETS credit notes in rather than listing them separately', () => {
    // A return reduces the period's outward supply; showing gross would not reconcile
    // against the GSTR-1 actually filed.
    const rows = hsnSummary([
      sale(),
      sale({ id: 'cn', invoiceType: 'CREDIT_NOTE', invoiceNumber: 'CN-1' }),
    ]);
    expect(rows[0].taxableValue).toBe(0);
    expect(rows[0].totalQuantity).toBe(0);
  });

  it('splits invoice-level tax across lines in proportion to taxable value', () => {
    const twoLine = sale({
      items: [
        { name: 'Ring', netWeight: 10, subtotal: 75000, hsnCode: '7113', gstRatePercent: 3 },
        { name: 'Coin', netWeight: 5, subtotal: 25000, hsnCode: '7118', gstRatePercent: 3 },
      ],
    } as Partial<SaleInvoice>);
    const rows = hsnSummary([twoLine]);
    expect(rows.find(r => r.hsnCode === '7113')?.totalTax).toBe(2250);
    expect(rows.find(r => r.hsnCode === '7118')?.totalTax).toBe(750);
  });

  it('buckets an unclassified line rather than dropping it', () => {
    const noHsn = sale({ items: [{ name: 'X', netWeight: 1, subtotal: 1000 }] } as Partial<SaleInvoice>);
    expect(hsnSummary([noHsn])[0].hsnCode).toBe('UNCLASSIFIED');
  });

  it('sorts by taxable value, largest first', () => {
    const rows = hsnSummary([sale({
      items: [
        { name: 'Coin', netWeight: 5, subtotal: 25000, hsnCode: '7118' },
        { name: 'Ring', netWeight: 10, subtotal: 75000, hsnCode: '7113' },
      ],
    } as Partial<SaleInvoice>)]);
    expect(rows[0].hsnCode).toBe('7113');
  });

  it('filters by period', () => {
    expect(hsnSummary([sale({ date: '2026-06-01' })], '2026-07-01', '2026-07-31')).toHaveLength(0);
  });
});

describe('hsnSummaryCsv', () => {
  it('carries the Table 12 columns', () => {
    const csv = hsnSummaryCsv(hsnSummary([sale()]));
    expect(csv).toContain('HSN');
    expect(csv).toContain('UQC');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

describe('reconcileRegisters — the milestone criteria, made executable', () => {
  it('passes against consistent data', () => {
    for (const c of reconcileRegisters([purchase()], suppliers, [sale()])) {
      expect(c.passes, `${c.label}: ${c.detail}`).toBe(true);
    }
  });

  it('passes on empty books', () => {
    for (const c of reconcileRegisters([], [], [])) expect(c.passes).toBe(true);
  });

  it('reconciles with a credit note in the period', () => {
    const rows = reconcileRegisters([purchase()], suppliers, [
      sale(),
      sale({ id: 'cn', invoiceType: 'CREDIT_NOTE', invoiceNumber: 'CN-1' }),
    ]);
    for (const c of rows) expect(c.passes, `${c.label}: ${c.detail}`).toBe(true);
  });

  it('FAILS the HSN check when a line carries no HSN — Rule 46 requires one', () => {
    const noHsn = sale({ items: [{ name: 'X', netWeight: 1, subtotal: 1000 }] } as Partial<SaleInvoice>);
    const check = reconcileRegisters([], [], [noHsn]).find(c => c.label.includes('carries an HSN'));
    expect(check?.passes).toBe(false);
  });

  it('excludes blocked credit from the ITC tie-out', () => {
    const rows = reconcileRegisters(
      [purchase(), purchase({ id: 'p2', supplierInvoiceNo: 'B', itcEligible: false })],
      suppliers, [sale()]
    );
    expect(rows[0].passes).toBe(true);
  });
});
