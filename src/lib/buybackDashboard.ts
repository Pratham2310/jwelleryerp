/**
 * Old Gold Buyback Dashboard (Milestone 53, PRD §14.9).
 *
 * An analytics view over old-gold intake, distinct from the transactional voucher (M14) and the
 * vault register (M15). Everything derives from `OldGoldVoucher[]` on each call — nothing stored,
 * so no figure here can disagree with the lots it describes.
 *
 * ─── The metric that earns this screen ────────────────────────────────────────────────
 * **Claimed versus tested purity.** A customer brings in a chain they believe is 22K; it assays at
 * 78%. That gap is the single most commercially important number in buyback, because it is where
 * disputes happen and where an under-tested lot quietly loses the shop money. Two rules follow:
 *
 *   - A voucher with **no recorded claim is excluded from the average**, never treated as
 *     agreeing with the test. Folding unclaimed lots in at parity would drag the gap toward zero
 *     and hide exactly what the metric exists to show.
 *   - The gap is reported as **tested − claimed**, so a negative number means the piece was worse
 *     than claimed. That is the direction that costs money, and it should read as negative.
 *
 * Melting loss is tracked against the lots actually melted (M43), not against all intake: a lot
 * still sitting in the safe has no loss yet, and averaging it in as zero would understate the
 * real refining loss.
 */

import type { OldGoldVoucher } from '../types';
import { roundMoney, roundWeight, sumMoney, sumWeight } from './money';
import { LOT_STATUS_LABEL } from './oldGoldVault';
import type { OldGoldLotStatus } from '../types';

function inPeriod(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function lotsInPeriod(
  vouchers: OldGoldVoucher[], from?: string, to?: string
): OldGoldVoucher[] {
  return vouchers.filter(v => inPeriod(v.date, from, to));
}

/* ─────────────────────────────── Headline ─────────────────────────────── */

export interface BuybackHeadline {
  lots: number;
  grossWeight: number;
  netPayableWeight: number;
  totalPaid: number;
  averageRatePerGram: number;
  /** Gross less net payable — what purity testing and melting allowance removed. */
  deductedWeight: number;
  deductedPercent: number;
}

export function buybackHeadline(vouchers: OldGoldVoucher[]): BuybackHeadline {
  const grossWeight = roundWeight(sumWeight(vouchers.map(v => v.grossWeight)));
  const netPayableWeight = roundWeight(sumWeight(vouchers.map(v => v.netPayableWeight)));
  const totalPaid = roundMoney(sumMoney(vouchers.map(v => v.buybackValue)));
  const deductedWeight = roundWeight(grossWeight - netPayableWeight);

  return {
    lots: vouchers.length,
    grossWeight,
    netPayableWeight,
    totalPaid,
    // Against net payable weight, which is what the shop actually bought and paid for.
    averageRatePerGram: netPayableWeight > 0 ? roundMoney(totalPaid / netPayableWeight) : 0,
    deductedWeight,
    deductedPercent: grossWeight > 0 ? roundWeight((deductedWeight / grossWeight) * 100) : 0,
  };
}

/* ─────────────────────────────── Purity bands ─────────────────────────────── */

export interface PurityBand {
  label: string;
  min: number;
  max: number;
}

/** Bands chosen around the marks Indian retail actually sees: 24K, 22K, 18K, and below. */
export const PURITY_BANDS: PurityBand[] = [
  { label: '95%+ (near fine)', min: 95, max: 101 },
  { label: '90–95% (22K)', min: 90, max: 95 },
  { label: '75–90% (18–21K)', min: 75, max: 90 },
  { label: 'Under 75%', min: 0, max: 75 },
];

export interface BandRow {
  label: string;
  lots: number;
  grossWeight: number;
  value: number;
  sharePercent: number;
}

export function intakeByPurityBand(vouchers: OldGoldVoucher[]): BandRow[] {
  const totalValue = roundMoney(sumMoney(vouchers.map(v => v.buybackValue)));

  return PURITY_BANDS
    .map(band => {
      const rows = vouchers.filter(
        v => v.testedPurityPercent >= band.min && v.testedPurityPercent < band.max
      );
      const value = roundMoney(sumMoney(rows.map(v => v.buybackValue)));
      return {
        label: band.label,
        lots: rows.length,
        grossWeight: roundWeight(sumWeight(rows.map(v => v.grossWeight))),
        value,
        sharePercent: totalValue > 0 ? roundWeight((value / totalValue) * 100) : 0,
      };
    })
    .filter(r => r.lots > 0);
}

/* ─────────────────────────────── Claimed vs tested ─────────────────────────────── */

export interface PurityGap {
  /** Lots that actually recorded a claim — the only ones the average can honestly cover. */
  comparableLots: number;
  lotsWithoutClaim: number;
  averageClaimed: number;
  averageTested: number;
  /** tested − claimed. Negative means pieces assay worse than customers believe. */
  averageGap: number;
  /** Lots where the test came in more than 2 points below the claim. */
  materiallyOverclaimed: number;
}

export const OVERCLAIM_TOLERANCE_POINTS = 2;

export function claimedVsTested(vouchers: OldGoldVoucher[]): PurityGap {
  const comparable = vouchers.filter(
    v => typeof v.claimedPurityPercent === 'number' && Number.isFinite(v.claimedPurityPercent)
  );

  if (comparable.length === 0) {
    return {
      comparableLots: 0,
      lotsWithoutClaim: vouchers.length,
      averageClaimed: 0,
      averageTested: 0,
      averageGap: 0,
      materiallyOverclaimed: 0,
    };
  }

  const averageClaimed = roundWeight(
    comparable.reduce((s, v) => s + (v.claimedPurityPercent ?? 0), 0) / comparable.length
  );
  const averageTested = roundWeight(
    comparable.reduce((s, v) => s + v.testedPurityPercent, 0) / comparable.length
  );

  return {
    comparableLots: comparable.length,
    lotsWithoutClaim: vouchers.length - comparable.length,
    averageClaimed,
    averageTested,
    averageGap: roundWeight(averageTested - averageClaimed),
    materiallyOverclaimed: comparable.filter(
      v => (v.claimedPurityPercent ?? 0) - v.testedPurityPercent > OVERCLAIM_TOLERANCE_POINTS
    ).length,
  };
}

/* ─────────────────────────────── Melting loss ─────────────────────────────── */

export interface MeltLossPoint {
  month: string;
  lots: number;
  expectedFine: number;
  recoveredFine: number;
  lossPercent: number;
}

/**
 * Loss trend across lots that have actually been melted. A lot still in the safe has no loss to
 * report, and counting it as zero would understate the shop's real refining loss.
 */
export function meltingLossTrend(vouchers: OldGoldVoucher[]): MeltLossPoint[] {
  const melted = vouchers.filter(
    v => v.status === 'Melted' && typeof v.recoveredFineWeight === 'number'
  );

  const months = [...new Set(melted.map(v => (v.meltedOn ?? v.date).slice(0, 7)))].sort();

  return months.map(month => {
    const rows = melted.filter(v => (v.meltedOn ?? v.date).slice(0, 7) === month);
    const expectedFine = roundWeight(
      sumWeight(rows.map(v => (v.grossWeight * v.testedPurityPercent) / 100))
    );
    const recoveredFine = roundWeight(sumWeight(rows.map(v => v.recoveredFineWeight ?? 0)));
    return {
      month,
      lots: rows.length,
      expectedFine,
      recoveredFine,
      lossPercent: expectedFine > 0
        ? roundWeight(((expectedFine - recoveredFine) / expectedFine) * 100)
        : 0,
    };
  });
}

/* ─────────────────────────────── Vault by state ─────────────────────────────── */

export interface VaultStateRow {
  status: OldGoldLotStatus;
  label: string;
  lots: number;
  grossWeight: number;
  value: number;
}

export function vaultByState(vouchers: OldGoldVoucher[]): VaultStateRow[] {
  const statuses = [...new Set(vouchers.map(v => v.status))] as OldGoldLotStatus[];
  return statuses
    .map(status => {
      const rows = vouchers.filter(v => v.status === status);
      return {
        status,
        label: LOT_STATUS_LABEL[status] ?? status,
        lots: rows.length,
        grossWeight: roundWeight(sumWeight(rows.map(v => v.grossWeight))),
        value: roundMoney(sumMoney(rows.map(v => v.buybackValue))),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/* ─────────────────────────────── Trend ─────────────────────────────── */

export interface IntakePoint {
  month: string;
  lots: number;
  grossWeight: number;
  value: number;
}

export function intakeByMonth(vouchers: OldGoldVoucher[]): IntakePoint[] {
  const months = [...new Set(vouchers.map(v => v.date.slice(0, 7)))].sort();
  return months.map(month => {
    const rows = vouchers.filter(v => v.date.slice(0, 7) === month);
    return {
      month,
      lots: rows.length,
      grossWeight: roundWeight(sumWeight(rows.map(v => v.grossWeight))),
      value: roundMoney(sumMoney(rows.map(v => v.buybackValue))),
    };
  });
}

/* ─────────────────────────────── Reconciliation ─────────────────────────────── */

export interface BuybackCheck {
  label: string;
  passes: boolean;
  detail: string;
}

/** The milestone's criterion — every figure ties back to the underlying lots — made executable. */
export function reconcileBuyback(vouchers: OldGoldVoucher[]): BuybackCheck[] {
  const head = buybackHeadline(vouchers);
  const bands = intakeByPurityBand(vouchers);
  const vault = vaultByState(vouchers);
  const months = intakeByMonth(vouchers);

  const bandLots = bands.reduce((n, b) => n + b.lots, 0);
  const vaultValue = roundMoney(sumMoney(vault.map(v => v.value)));
  const monthValue = roundMoney(sumMoney(months.map(m => m.value)));

  return [
    {
      label: 'Purity bands cover every lot',
      passes: bandLots === head.lots,
      detail: `${bandLots} banded vs ${head.lots} lots`,
    },
    {
      label: 'Vault states tie to total paid',
      passes: vaultValue === head.totalPaid,
      detail: `₹${vaultValue.toLocaleString('en-IN')} vs ₹${head.totalPaid.toLocaleString('en-IN')}`,
    },
    {
      label: 'Monthly intake ties to total paid',
      passes: monthValue === head.totalPaid,
      detail: `₹${monthValue.toLocaleString('en-IN')} vs ₹${head.totalPaid.toLocaleString('en-IN')}`,
    },
    {
      label: 'Net payable weight never exceeds gross',
      // Paying for more metal than came through the door would mean a valuation bug upstream.
      passes: head.netPayableWeight <= head.grossWeight,
      detail: `${head.netPayableWeight.toFixed(3)} g payable of ${head.grossWeight.toFixed(3)} g gross`,
    },
  ];
}
