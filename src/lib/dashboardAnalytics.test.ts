import { describe, it, expect } from 'vitest';
import {
  monthlyRevenueTrend,
  buildTrendGeometry,
  formatCompactINR,
  buildActivityFeed,
} from './dashboardAnalytics';
import type { SaleInvoice, Tag, JobWork, LooseStone } from '../types';

function inv(partial: Partial<SaleInvoice>): SaleInvoice {
  return {
    id: partial.id || 'i1',
    invoiceType: partial.invoiceType || 'TAX_INVOICE',
    invoiceNumber: partial.invoiceNumber || 'INV-2026-1',
    date: partial.date || '2026-07-10',
    customerName: partial.customerName || 'Test Customer',
    customerPhone: '9999999999',
    items: partial.items || [],
    oldGoldWeight: 0,
    oldGoldValue: 0,
    subtotal: partial.subtotal ?? 0,
    tax: 0,
    discount: 0,
    grandTotal: partial.grandTotal ?? 0,
    netAmountDue: partial.netAmountDue ?? 0,
    paymentMethod: 'Cash',
    ...partial,
  } as SaleInvoice;
}

const ASOF = new Date(2026, 6, 26); // July 2026

describe('monthlyRevenueTrend', () => {
  it('returns exactly the requested number of trailing months, ending with the current one', () => {
    const series = monthlyRevenueTrend([], 6, ASOF);
    expect(series).toHaveLength(6);
    expect(series.map(s => s.label)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']);
    expect(series[5].key).toBe('2026-07');
  });

  it('returns zero-revenue months rather than omitting them', () => {
    const series = monthlyRevenueTrend([inv({ date: '2026-07-10', grandTotal: 50000 })], 6, ASOF);
    expect(series.filter(s => s.revenue === 0)).toHaveLength(5);
    expect(series[5].revenue).toBe(50000);
  });

  it('buckets invoices into the right month', () => {
    const series = monthlyRevenueTrend([
      inv({ id: 'a', date: '2026-05-02', grandTotal: 10000 }),
      inv({ id: 'b', date: '2026-05-28', grandTotal: 5000 }),
      inv({ id: 'c', date: '2026-07-01', grandTotal: 20000 }),
    ], 6, ASOF);
    expect(series.find(s => s.key === '2026-05')!.revenue).toBe(15000);
    expect(series.find(s => s.key === '2026-07')!.revenue).toBe(20000);
  });

  it('excludes estimates from revenue', () => {
    const series = monthlyRevenueTrend([
      inv({ id: 'a', date: '2026-07-05', grandTotal: 100000 }),
      inv({ id: 'b', date: '2026-07-06', grandTotal: 999999, invoiceType: 'ESTIMATE' }),
    ], 6, ASOF);
    expect(series[5].revenue).toBe(100000);
  });

  it('nets credit notes against sales in the same month', () => {
    const series = monthlyRevenueTrend([
      inv({ id: 'a', date: '2026-07-05', grandTotal: 100000 }),
      inv({ id: 'b', date: '2026-07-20', grandTotal: -40000, invoiceType: 'CREDIT_NOTE' }),
    ], 6, ASOF);
    expect(series[5].revenue).toBe(60000);
  });

  it('ignores invoices outside the window', () => {
    const series = monthlyRevenueTrend([inv({ date: '2025-01-10', grandTotal: 500000 })], 6, ASOF);
    expect(series.every(s => s.revenue === 0)).toBe(true);
  });

  it('spans a year boundary correctly', () => {
    const series = monthlyRevenueTrend([inv({ date: '2025-12-10', grandTotal: 7000 })], 6, new Date(2026, 1, 15));
    expect(series.map(s => s.label)).toEqual(['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']);
    expect(series.find(s => s.key === '2025-12')!.revenue).toBe(7000);
  });
});

describe('buildTrendGeometry', () => {
  const geomOpts = { width: 600, height: 220, padLeft: 40, padRight: 20, padTop: 20, padBottom: 20 };

  it('plots one point per month, evenly spaced across the plot width', () => {
    const series = monthlyRevenueTrend([], 6, ASOF);
    const g = buildTrendGeometry(series, geomOpts);
    expect(g.points).toHaveLength(6);
    expect(g.points[0].x).toBe(40);
    expect(g.points[5].x).toBe(580);
  });

  it('puts a zero month on the baseline and the max month at the top of the plot', () => {
    const series = monthlyRevenueTrend([inv({ date: '2026-07-10', grandTotal: 500000 })], 6, ASOF);
    const g = buildTrendGeometry(series, geomOpts);
    expect(g.points[0].y).toBe(200); // baseline = padTop + plotH
    expect(g.points[5].y).toBe(20); // top of plot, since it equals the rounded axis max
  });

  it('never inverts the chart when a month is net negative', () => {
    const series = monthlyRevenueTrend([inv({ date: '2026-07-10', grandTotal: -50000, invoiceType: 'CREDIT_NOTE' })], 6, ASOF);
    const g = buildTrendGeometry(series, geomOpts);
    expect(g.points.every(p => p.y <= 200 && p.y >= 20)).toBe(true);
  });

  it('produces a usable axis even with no data at all', () => {
    const g = buildTrendGeometry(monthlyRevenueTrend([], 6, ASOF), geomOpts);
    expect(g.maxValue).toBeGreaterThan(0);
    expect(g.yTicks).toHaveLength(5);
    expect(g.linePath.startsWith('M ')).toBe(true);
  });

  it('closes the area path back to the baseline', () => {
    const g = buildTrendGeometry(monthlyRevenueTrend([inv({ date: '2026-07-01', grandTotal: 1000 })], 6, ASOF), geomOpts);
    expect(g.areaPath.endsWith('Z')).toBe(true);
  });
});

describe('formatCompactINR', () => {
  it('formats lakhs and crores the Indian way', () => {
    expect(formatCompactINR(0)).toBe('₹0');
    expect(formatCompactINR(750)).toBe('₹750');
    expect(formatCompactINR(45000)).toBe('₹45K');
    expect(formatCompactINR(512000)).toBe('₹5.1L');
    expect(formatCompactINR(2500000)).toBe('₹25L');
    expect(formatCompactINR(15000000)).toBe('₹1.5Cr');
  });

  it('keeps the sign on negatives', () => {
    expect(formatCompactINR(-512000)).toBe('-₹5.1L');
  });
});

describe('buildActivityFeed', () => {
  const tag = (over: Partial<Tag>): Tag => ({
    id: 't1', sku: 'SKU-1', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
    metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, stoneType: 'None',
    stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock', ...over,
  });

  it('is empty when there is no state at all, rather than showing invented events', () => {
    expect(buildActivityFeed([], [], [], [])).toEqual([]);
  });

  it('labels each document type distinctly', () => {
    const feed = buildActivityFeed([
      inv({ id: 'a', invoiceNumber: 'INV-1', date: '2026-07-01', grandTotal: 1000 }),
      inv({ id: 'b', invoiceNumber: 'EST-1', date: '2026-07-02', grandTotal: 2000, invoiceType: 'ESTIMATE' }),
      inv({ id: 'c', invoiceNumber: 'CRN-1', date: '2026-07-03', grandTotal: -500, invoiceType: 'CREDIT_NOTE' }),
    ], [], [], []);
    expect(feed.map(e => e.kind)).toEqual(['credit_note', 'estimate', 'sale']);
    expect(feed[0].title).toContain('CRN-1');
    expect(feed[0].detail).toContain('₹500'); // shown as a positive refund amount
  });

  it('sorts most-recent first and respects the limit', () => {
    const feed = buildActivityFeed([
      inv({ id: 'a', date: '2026-07-01', grandTotal: 1 }),
      inv({ id: 'b', date: '2026-07-20', grandTotal: 2 }),
      inv({ id: 'c', date: '2026-07-10', grandTotal: 3 }),
    ], [], [], [], 2);
    expect(feed).toHaveLength(2);
    expect(feed[0].date).toBe('2026-07-20');
    expect(feed[1].date).toBe('2026-07-10');
  });

  it('surfaces returned and written-off tags but not ordinary in-stock ones', () => {
    const feed = buildActivityFeed([], [
      tag({ id: 'ok', status: 'InStock' }),
      tag({ id: 'ret', sku: 'SKU-RET', status: 'Returned' }),
      tag({ id: 'dead', sku: 'SKU-DEAD', status: 'DamagedOrMelted' }),
    ], [], []);
    expect(feed).toHaveLength(2);
    expect(feed.map(e => e.kind)).toEqual(['stock', 'stock']);
  });

  it('includes job bags and issued stones, but not vaulted stones', () => {
    const bags: JobWork[] = [{
      id: 'b1', jobNo: 'JOB-2026-001', karigarId: 'kar-1', karigarName: 'Ramesh',
      clientName: 'C', designName: 'D', category: 'Rings', metalType: 'Gold (22K)',
      goldIssued: 12, issueDate: '2026-07-15', dueDate: '2026-08-01', stage: 'Casting',
      priority: 'Normal', stonesIssued: '-', metalLossRecorded: 0,
      receiptStatus: 'Pending', createdAt: '2026-07-15',
    }];
    const stones: LooseStone[] = [
      { id: 's1', lotNo: 'LOT-1', stoneType: 'Diamond', cut: 'Oval', color: 'G', clarity: 'VS1', caratWeight: 2, quantity: 1, valuePerCarat: 1000, totalValue: 2000, certification: 'GIA', status: 'Issued', assignedKarigarName: 'Ramesh' },
      { id: 's2', lotNo: 'LOT-2', stoneType: 'Ruby', cut: 'Oval', color: 'R', clarity: 'VS1', caratWeight: 1, quantity: 1, valuePerCarat: 500, totalValue: 500, certification: 'None', status: 'In Vault' },
    ];
    const feed = buildActivityFeed([], [], bags, stones);
    expect(feed.some(e => e.kind === 'jobbag')).toBe(true);
    expect(feed.filter(e => e.kind === 'stone')).toHaveLength(1);
  });
});
