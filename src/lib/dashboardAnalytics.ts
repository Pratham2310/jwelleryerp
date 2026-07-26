// Dashboard analytics derived from real state (Milestone 13). Previously the Monthly Sales
// Revenue Trend was hardcoded SVG coordinates and the ERP Action Log was a static list, both
// of which read as real data to anyone looking at the screen.

import type { SaleInvoice, Tag, JobBag, LooseStone } from '../types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthlyRevenuePoint {
  key: string; // "2026-07"
  label: string; // "Jul"
  year: number;
  revenue: number; // net of credit notes, estimates excluded
}

/**
 * Groups fiscal documents into the trailing `months` calendar months ending with `asOf`'s month.
 * Months with no sales are returned as zero rather than omitted, so the x-axis stays evenly
 * spaced and an empty month is visibly empty instead of silently collapsing the chart.
 *
 * Estimates are excluded (non-fiscal, Milestone 11); credit notes carry negative totals
 * (Milestone 12) so including them yields revenue net of returns.
 */
export function monthlyRevenueTrend(
  invoices: SaleInvoice[],
  months = 6,
  asOf: Date = new Date()
): MonthlyRevenuePoint[] {
  const buckets: MonthlyRevenuePoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      revenue: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const inv of invoices) {
    if (inv.invoiceType === 'ESTIMATE') continue;
    // Invoice dates are stored as "YYYY-MM-DD"; slice rather than parse to avoid timezone drift
    const key = (inv.date || '').slice(0, 7);
    const at = index.get(key);
    if (at !== undefined) {
      buckets[at].revenue += inv.grandTotal;
    }
  }

  return buckets;
}

/** Builds an SVG polyline path plus plotted points for a trend series inside a viewBox. */
export interface TrendGeometry {
  points: { x: number; y: number; value: number; label: string }[];
  linePath: string;
  areaPath: string;
  yTicks: { y: number; value: number }[];
  maxValue: number;
}

export function buildTrendGeometry(
  series: MonthlyRevenuePoint[],
  opts: { width: number; height: number; padLeft: number; padRight: number; padTop: number; padBottom: number }
): TrendGeometry {
  const { width, height, padLeft, padRight, padTop, padBottom } = opts;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Clamp negatives to zero for scaling: a net-negative month (heavy returns) still renders on
  // the baseline rather than inverting the chart.
  const values = series.map(s => Math.max(0, s.revenue));
  const rawMax = Math.max(...values, 0);
  // Round the axis up to a clean number so the gridline labels read sensibly
  const maxValue = rawMax <= 0 ? 100000 : Math.ceil(rawMax / 100000) * 100000;

  const points = series.map((s, i) => {
    const x = series.length === 1
      ? padLeft + plotW / 2
      : padLeft + (i / (series.length - 1)) * plotW;
    const y = padTop + plotH - (Math.max(0, s.revenue) / maxValue) * plotH;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), value: s.revenue, label: s.label };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const baseline = padTop + plotH;
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
    : '';

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => ({
    y: Number((padTop + plotH - (i / tickCount) * plotH).toFixed(2)),
    value: (maxValue / tickCount) * i,
  }));

  return { points, linePath, areaPath, yTicks, maxValue };
}

/** Compact Indian-format currency for axis labels: 512000 -> "₹5.1L". */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
  return `${sign}₹${abs}`;
}

// ---------- Activity feed ----------

export type ActivityKind = 'sale' | 'credit_note' | 'estimate' | 'jobbag' | 'stone' | 'stock';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  date: string; // YYYY-MM-DD
  sortAt: number; // higher = more recent
}

/**
 * Derives a recent-activity feed from real state. This is an interim source until Milestone 50
 * introduces a proper event store — it reconstructs events from current records rather than
 * logging them as they happen, so it cannot show anything the state doesn't still contain
 * (e.g. a deleted tag). That limitation is deliberate and preferable to the previous hardcoded
 * list, which showed four invented events that never happened.
 */
export function buildActivityFeed(
  invoices: SaleInvoice[],
  tags: Tag[],
  jobBags: JobBag[],
  stones: LooseStone[],
  limit = 6
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const inv of invoices) {
    const at = Date.parse(inv.date || '') || 0;
    if (inv.invoiceType === 'CREDIT_NOTE') {
      events.push({
        id: `crn-${inv.id}`,
        kind: 'credit_note',
        title: `Credit note ${inv.invoiceNumber} raised`,
        detail: `₹${Math.abs(inv.grandTotal).toLocaleString('en-IN')} refunded to ${inv.customerName}`,
        date: inv.date,
        sortAt: at,
      });
    } else if (inv.invoiceType === 'ESTIMATE') {
      events.push({
        id: `est-${inv.id}`,
        kind: 'estimate',
        title: `Estimate ${inv.invoiceNumber} issued`,
        detail: `₹${inv.grandTotal.toLocaleString('en-IN')} quoted to ${inv.customerName}`,
        date: inv.date,
        sortAt: at,
      });
    } else {
      events.push({
        id: `inv-${inv.id}`,
        kind: 'sale',
        title: `Invoice ${inv.invoiceNumber} completed`,
        detail: `₹${inv.grandTotal.toLocaleString('en-IN')} billed to ${inv.customerName}`,
        date: inv.date,
        sortAt: at,
      });
    }
  }

  for (const bag of jobBags) {
    events.push({
      id: `bag-${bag.id}`,
      kind: 'jobbag',
      title: `Job bag ${bag.bagNo} at ${bag.currentStage}`,
      detail: `${bag.metalIssuedWeight.toFixed(2)}g with ${bag.assignedKarigarName}`,
      date: bag.createdAt,
      sortAt: Date.parse(bag.createdAt || '') || 0,
    });
  }

  for (const tag of tags) {
    if (tag.status === 'Returned' || tag.status === 'DamagedOrMelted') {
      events.push({
        id: `tag-${tag.id}`,
        kind: 'stock',
        title: `${tag.sku} marked ${tag.status === 'Returned' ? 'Returned' : 'Damaged / Melted'}`,
        detail: `${tag.name} · ${tag.netWeight.toFixed(2)}g`,
        date: '',
        sortAt: 0,
      });
    }
  }

  for (const stone of stones) {
    if (stone.status === 'Issued') {
      events.push({
        id: `stone-${stone.id}`,
        kind: 'stone',
        title: `Stone lot ${stone.lotNo} issued`,
        detail: `${stone.caratWeight}ct ${stone.stoneType} to ${stone.assignedKarigarName || 'karigar'}`,
        date: '',
        sortAt: 0,
      });
    }
  }

  return events.sort((a, b) => b.sortAt - a.sortAt).slice(0, limit);
}
