import { describe, it, expect } from 'vitest';
import {
  fiscalDocuments,
  inPeriod,
  dailySalesSummary,
  salesRegister,
  salesTotals,
  stockSummary,
  daysHeld,
  ageBucketOf,
  inventoryAgeing,
  slowMovingValue,
  customerHistory,
  customerProfile,
  tierDistribution,
  panComplianceExceptions,
  karigarReconciliation,
  supplierPurchases,
  branchComparison,
  reconcileReports,
  AGE_BUCKET_LABEL,
} from './reports';
import type { SaleInvoice, Tag, MetalRate, Customer } from '../types';

const rates: MetalRate[] = [
  { id: 'r1', metalType: 'Gold (22K)', purity: '91.6%', ratePerGram: 6650, change24h: 0, history24h: [] },
  { id: 'r2', metalType: 'Silver (999)', purity: '99.9%', ratePerGram: 92, change24h: 0, history24h: [] },
];

function invoice(over: Partial<SaleInvoice> = {}): SaleInvoice {
  return {
    id: 'i1', invoiceNumber: 'INV-1', date: '2026-07-10', customerName: 'Sharda Sharma',
    invoiceType: 'TAX_INVOICE', items: [], subtotal: 10000, discount: 0, tax: 300,
    grandTotal: 10300, paymentMethod: 'Cash', branchId: 'br-1', ...over,
  } as SaleInvoice;
}

function tag(over: Partial<Tag> = {}): Tag {
  return {
    id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
    metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, stoneType: 'None',
    stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED',
    status: 'InStock', branchId: 'br-1', ...over,
  };
}

describe('document type decides whether a sales report is right', () => {
  const book = [
    invoice({ id: 'a', invoiceNumber: 'INV-1', grandTotal: 10300 }),
    invoice({ id: 'b', invoiceNumber: 'EST-1', invoiceType: 'ESTIMATE', grandTotal: 99999 }),
    invoice({ id: 'c', invoiceNumber: 'CRN-1', invoiceType: 'CREDIT_NOTE', grandTotal: -2000, subtotal: -2000, tax: -60 }),
  ];

  it('EXCLUDES estimates — a quotation is not a supply', () => {
    expect(fiscalDocuments(book).map(i => i.invoiceNumber)).toEqual(['INV-1', 'CRN-1']);
  });

  it('INCLUDES credit notes, which is what makes revenue net of returns', () => {
    expect(salesTotals(book, '2026-07-01', '2026-07-31').total).toBe(8300); // 10300 − 2000
  });

  it('reports how many estimates were left out, rather than silently dropping them', () => {
    expect(salesTotals(book, '2026-07-01', '2026-07-31').estimatesExcluded).toBe(1);
  });

  it('respects the period boundaries inclusively', () => {
    const rows = [invoice({ date: '2026-07-01' }), invoice({ id: 'z', date: '2026-07-31' })];
    expect(inPeriod(rows, '2026-07-01', '2026-07-31')).toHaveLength(2);
    expect(inPeriod(rows, '2026-07-02', '2026-07-30')).toHaveLength(0);
  });
});

describe('daily sales summary & register', () => {
  const book = [
    invoice({ id: 'a', invoiceNumber: 'INV-1', date: '2026-07-10' }),
    invoice({ id: 'b', invoiceNumber: 'INV-2', date: '2026-07-10' }),
    invoice({ id: 'c', invoiceNumber: 'CRN-1', date: '2026-07-12', invoiceType: 'CREDIT_NOTE', grandTotal: -2000, subtotal: -2000, tax: -60 }),
  ];

  it('groups by date and counts invoices and credit notes apart', () => {
    const rows = dailySalesSummary(book, '2026-07-01', '2026-07-31');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-07-10', invoices: 2, creditNotes: 0, total: 20600 });
    expect(rows[1]).toMatchObject({ date: '2026-07-12', invoices: 0, creditNotes: 1, total: -2000 });
  });

  it('lists the register chronologically', () => {
    expect(salesRegister(book, '2026-07-01', '2026-07-31').map(r => r.invoiceNumber))
      .toEqual(['INV-1', 'INV-2', 'CRN-1']);
  });

  it('labels a nameless buyer as walk-in rather than blank', () => {
    expect(salesRegister([invoice({ customerName: '' })], '2026-07-01', '2026-07-31')[0].customerName)
      .toBe('Walk-in');
  });
});

describe('stock summary', () => {
  const tags = [
    tag({ id: 'a', metalType: 'Gold (22K)', netWeight: 10, stoneCharge: 5000 }),
    tag({ id: 'b', metalType: 'Gold (22K)', netWeight: 20 }),
    tag({ id: 'c', metalType: 'Silver (999)', netWeight: 50 }),
    tag({ id: 'd', metalType: 'Gold (22K)', netWeight: 99, status: 'Sold' }),
  ];

  it('counts only sellable stock — sold pieces are not inventory', () => {
    const rows = stockSummary(tags, rates);
    expect(rows.find(r => r.metalType === 'Gold (22K)')!.pieces).toBe(2);
  });

  it('values metal plus stones, excluding making charge', () => {
    const gold = stockSummary(tags, rates).find(r => r.metalType === 'Gold (22K)')!;
    expect(gold.estimatedValue).toBe(30 * 6650 + 5000);
  });

  it('sums weight without drift', () => {
    expect(stockSummary(tags, rates).find(r => r.metalType === 'Gold (22K)')!.netWeight).toBe(30);
  });

  it('is empty when nothing is sellable', () => {
    expect(stockSummary([tag({ status: 'Sold' })], rates)).toEqual([]);
  });
});

describe('inventory ageing — an undated tag is never "new"', () => {
  const today = '2026-08-01';

  it('measures days held', () => {
    expect(daysHeld('2026-07-02', today)).toBe(30);
    expect(daysHeld(undefined, today)).toBeNull();
  });

  it('buckets by age', () => {
    expect(ageBucketOf(30)).toBe('0-90');
    expect(ageBucketOf(90)).toBe('0-90');
    expect(ageBucketOf(91)).toBe('91-180');
    expect(ageBucketOf(200)).toBe('181-365');
    expect(ageBucketOf(400)).toBe('365+');
  });

  it('puts an unknown date in its OWN bucket, not the newest', () => {
    // Folding unknowns into 0-90 would report zero old stock, hiding the very capital problem
    // the report exists to surface.
    expect(ageBucketOf(null)).toBe('unknown');
    const rows = inventoryAgeing([tag({ taggedOn: undefined })], rates, today);
    expect(rows).toHaveLength(1);
    expect(rows[0].bucket).toBe('unknown');
  });

  it('spreads stock across buckets', () => {
    const rows = inventoryAgeing([
      tag({ id: 'a', taggedOn: '2026-07-20' }),
      tag({ id: 'b', taggedOn: '2026-04-01' }),
      tag({ id: 'c', taggedOn: '2025-01-01' }),
    ], rates, today);
    expect(rows.map(r => r.bucket)).toEqual(['0-90', '91-180', '365+']);
  });

  it('omits empty buckets rather than printing zero rows', () => {
    expect(inventoryAgeing([tag({ taggedOn: '2026-07-20' })], rates, today)).toHaveLength(1);
  });

  it('totals the capital tied up beyond the threshold', () => {
    const rows = inventoryAgeing([
      tag({ id: 'a', taggedOn: '2026-07-20', netWeight: 10 }),
      tag({ id: 'b', taggedOn: '2025-01-01', netWeight: 20 }),
    ], rates, today);
    expect(slowMovingValue(rows, 180)).toBe(20 * 6650);
  });

  it('labels every bucket', () => {
    expect(Object.keys(AGE_BUCKET_LABEL)).toHaveLength(5);
  });
});

describe('customer reports', () => {
  const book = [
    invoice({ id: 'a', invoiceNumber: 'INV-1', date: '2026-07-10', grandTotal: 10300 }),
    invoice({ id: 'b', invoiceNumber: 'INV-2', date: '2026-07-20', grandTotal: 5000 }),
    invoice({ id: 'c', invoiceNumber: 'CRN-1', date: '2026-07-25', invoiceType: 'CREDIT_NOTE', grandTotal: -2000 }),
    invoice({ id: 'd', invoiceNumber: 'EST-1', invoiceType: 'ESTIMATE', grandTotal: 99999 }),
    invoice({ id: 'e', invoiceNumber: 'INV-9', customerName: 'Someone Else', grandTotal: 77777 }),
  ];

  it('returns one customer’s documents, newest first', () => {
    const h = customerHistory(book, 'Sharda Sharma');
    expect(h.map(e => e.invoiceNumber)).toEqual(['CRN-1', 'INV-2', 'INV-1', 'EST-1']);
  });

  it('matches the name case- and space-insensitively', () => {
    expect(customerHistory(book, '  sharda sharma  ')).toHaveLength(4);
  });

  it('computes lifetime value NET of returns, excluding estimates', () => {
    const p = customerProfile(book, 'Sharda Sharma');
    expect(p.lifetimeValue).toBe(13300); // 10300 + 5000 − 2000
    expect(p.purchaseCount).toBe(2);
    expect(p.returnCount).toBe(1);
    expect(p.estimateCount).toBe(1);
  });

  it('reports first and last purchase and an average ticket', () => {
    const p = customerProfile(book, 'Sharda Sharma');
    expect(p.firstPurchase).toBe('2026-07-10');
    expect(p.lastPurchase).toBe('2026-07-25');
    expect(p.averageTicket).toBe(7650); // (10300 + 5000) / 2
  });

  it('handles a customer with no history without dividing by zero', () => {
    const p = customerProfile(book, 'Nobody');
    expect(p).toMatchObject({ lifetimeValue: 0, purchaseCount: 0, averageTicket: 0, firstPurchase: null });
  });

  it('distributes customers by tier, richest first', () => {
    const customers = [
      { tier: 'Gold', lifetimeSpend: 100000 },
      { tier: 'Bronze', lifetimeSpend: 5000 },
      { tier: 'Gold', lifetimeSpend: 50000 },
    ] as Customer[];
    const rows = tierDistribution(customers);
    expect(rows[0]).toMatchObject({ tier: 'Gold', customers: 2, lifetimeSpend: 150000 });
  });

  it('flags invoices over the PAN threshold with no declaration', () => {
    const exceptions = panComplianceExceptions([
      invoice({ id: 'x', invoiceNumber: 'INV-BIG', grandTotal: 250000 }),
      invoice({ id: 'y', invoiceNumber: 'INV-SMALL', grandTotal: 5000 }),
      invoice({ id: 'z', invoiceNumber: 'EST-BIG', invoiceType: 'ESTIMATE', grandTotal: 250000 }),
    ]);
    expect(exceptions.map(e => e.invoiceNumber)).toEqual(['INV-BIG']);
  });
});

describe('karigar reconciliation keeps weight and money apart (D-2)', () => {
  it('reports both without netting them', () => {
    const rows = karigarReconciliation(
      [{ id: 'k1', name: 'Ramesh' } as never],
      [
        { id: 'e1', karigarId: 'k1', date: '2026-07-01', sequence: 1, type: 'METAL_ISSUED', narration: '', fineWeightDelta: 91.6 },
        { id: 'e2', karigarId: 'k1', date: '2026-07-02', sequence: 2, type: 'LABOUR_CHARGED', narration: '', moneyDelta: 5000 },
      ] as never
    );
    expect(rows[0].fineWeightPayable).toBeCloseTo(91.6, 3);
    expect(rows[0].moneyPayable).toBe(5000);
    expect(rows[0].entries).toBe(2);
  });
});

describe('supplier purchases keep credit and liability apart', () => {
  it('never sums reverse-charge liability into claimable ITC', () => {
    const rows = supplierPurchases(
      [
        { id: 'p1', supplierId: 's1', taxableValue: 100000, totalTax: 3000, itcEligible: true, isReverseCharge: false } as never,
        { id: 'p2', supplierId: 's1', taxableValue: 50000, totalTax: 9000, itcEligible: true, isReverseCharge: true } as never,
      ],
      [{ id: 's1', name: 'Zaveri Bullion' } as never]
    );
    expect(rows[0].taxableValue).toBe(150000);
    expect(rows[0].claimableItc).toBe(12000);
    expect(rows[0].reverseChargeLiability).toBe(9000);
  });

  it('names an unknown supplier rather than showing a bare id', () => {
    const rows = supplierPurchases(
      [{ id: 'p1', supplierId: 'ghost', taxableValue: 1, totalTax: 0, itcEligible: true, isReverseCharge: false } as never],
      []
    );
    expect(rows[0].name).toBe('Unknown supplier');
  });
});

describe('branch comparison', () => {
  it('reports stock and sales per branch', () => {
    const rows = branchComparison(
      [{ id: 'br-1', name: 'Mumbai' } as never, { id: 'br-2', name: 'Pune' } as never],
      [tag({ id: 'a', branchId: 'br-1', netWeight: 10 }), tag({ id: 'b', branchId: 'br-2', netWeight: 5 })],
      [invoice({ branchId: 'br-1', grandTotal: 10300 })],
      '2026-07-01', '2026-07-31'
    );
    expect(rows[0]).toMatchObject({ name: 'Mumbai', sellablePieces: 1, stockWeight: 10, salesValue: 10300 });
    expect(rows[1]).toMatchObject({ name: 'Pune', salesValue: 0 });
  });
});

describe('reconcileReports — the milestone criterion, made executable', () => {
  const book = [
    invoice({ id: 'a', invoiceNumber: 'INV-1', date: '2026-07-10' }),
    invoice({ id: 'b', invoiceNumber: 'CRN-1', date: '2026-07-12', invoiceType: 'CREDIT_NOTE', grandTotal: -2000, subtotal: -2000, tax: -60 }),
    invoice({ id: 'c', invoiceNumber: 'EST-1', invoiceType: 'ESTIMATE', grandTotal: 99999 }),
  ];
  const tags = [tag({ id: 'a', taggedOn: '2026-07-01' }), tag({ id: 'b', taggedOn: undefined })];

  it('every check reconciles on consistent data', () => {
    const checks = reconcileReports(book, tags, rates, '2026-07-01', '2026-07-31');
    for (const c of checks) {
      expect(c.reconciles, `${c.label}: ${c.reportTotal} vs ${c.sourceTotal}`).toBe(true);
      expect(c.difference).toBe(0);
    }
  });

  it('checks the sales reports against the invoice register itself', () => {
    const checks = reconcileReports(book, tags, rates, '2026-07-01', '2026-07-31');
    expect(checks.some(c => c.label.includes('Daily Sales Summary'))).toBe(true);
    expect(checks.find(c => c.label.includes('Sales totals'))!.sourceTotal).toBe(8300);
  });

  it('checks ageing against the stock summary, including the unknown bucket', () => {
    // If unknowns were dropped from ageing this reconciliation would fail, which is the point.
    const checks = reconcileReports(book, tags, rates, '2026-07-01', '2026-07-31');
    const pieces = checks.find(c => c.label.includes('Ageing piece count'))!;
    expect(pieces.reportTotal).toBe(2);
    expect(pieces.reconciles).toBe(true);
  });

  it('reconciles on an empty book', () => {
    for (const c of reconcileReports([], [], rates, '2026-07-01', '2026-07-31')) {
      expect(c.reconciles).toBe(true);
    }
  });
});
