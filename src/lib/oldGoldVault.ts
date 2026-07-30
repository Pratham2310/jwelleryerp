// Old Gold vault lifecycle (PRD §8.2 step 7 / §6.3, Milestone 15).
//
// A received lot is real metal sitting in the shop's safe, so its movement is governed by an
// enforced state machine for the same reason Tag.status is (Milestone 4): "how did this lot
// become fine gold stock" must be answerable, and metal must never silently change state.

import type { OldGoldLotStatus, OldGoldVoucher } from '../types';

import { sumMoney, sumWeight } from './money';

export const ALL_LOT_STATUSES: OldGoldLotStatus[] = [
  'InSafe',
  'SentForMelting',
  'Melted',
  'FineGoldStock',
  'ResaleAsIs',
];

export const LOT_STATUS_LABEL: Record<OldGoldLotStatus, string> = {
  InSafe: 'In Safe',
  SentForMelting: 'Sent for Melting',
  Melted: 'Melted',
  FineGoldStock: 'Fine Gold Stock',
  ResaleAsIs: 'Retagged for Resale',
};

// Terminal: once the metal is fine gold stock or has been retagged for resale as-is, this
// voucher's lot no longer exists as a distinct old-gold holding.
const TERMINAL: ReadonlySet<OldGoldLotStatus> = new Set(['FineGoldStock', 'ResaleAsIs']);

const TRANSITIONS: Record<OldGoldLotStatus, OldGoldLotStatus[]> = {
  // PRD §8.2 step 7: either send for melting, or — rarely, for antique/investment pieces —
  // retag the item for direct resale without melting it.
  InSafe: ['SentForMelting', 'ResaleAsIs'],
  // Metal can come back from the refiner unmelted (rejected batch, refiner unavailable).
  SentForMelting: ['Melted', 'InSafe'],
  // Recovered fine weight is captured on this transition, so Melted must be passed through
  // rather than jumping InSafe -> FineGoldStock directly.
  Melted: ['FineGoldStock'],
  FineGoldStock: [],
  ResaleAsIs: [],
};

export function canTransitionLot(from: OldGoldLotStatus, to: OldGoldLotStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextLotStatuses(from: OldGoldLotStatus): OldGoldLotStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Lots still physically held by the shop as old gold (i.e. not yet converted or resold). */
export function isHeldInVault(status: OldGoldLotStatus): boolean {
  return status === 'InSafe' || status === 'SentForMelting' || status === 'Melted';
}

export interface VaultSummary {
  lotsInSafe: number;
  lotsAtRefiner: number;
  lotsMelted: number;
  grossWeightHeld: number; // as-received grams still in the vault cycle
  expectedFineWeight: number; // sum of net payable weights for lots still held
  recoveredFineWeight: number; // actual fine gold recovered from melted lots
  refiningVariance: number; // recovered − expected, for lots that have been melted
  capitalDeployed: number; // ₹ paid out for lots still in the vault cycle
}

/**
 * Rolls the voucher register up into a vault position.
 *
 * `refiningVariance` is the number that matters operationally: it compares what the refiner
 * actually returned against what the melt valuation predicted. A persistently negative
 * variance means the shop's melting-loss deduction is set too low and it is losing metal on
 * every buyback.
 */
export function summariseVault(vouchers: OldGoldVoucher[]): VaultSummary {
  const held = vouchers.filter(v => isHeldInVault(v.status));
  const meltedLots = vouchers.filter(v => v.status === 'Melted' || v.status === 'FineGoldStock');

  const recoveredFineWeight = sumWeight(meltedLots.map(v => v.recoveredFineWeight || 0));
  const expectedFromMelted = meltedLots
    .filter(v => v.recoveredFineWeight !== undefined)
    .reduce((s, v) => s + v.netPayableWeight, 0); // eslint-disable-line -- narrowed below

  return {
    lotsInSafe: vouchers.filter(v => v.status === 'InSafe').length,
    lotsAtRefiner: vouchers.filter(v => v.status === 'SentForMelting').length,
    lotsMelted: vouchers.filter(v => v.status === 'Melted').length,
    grossWeightHeld: sumWeight(held.map(v => v.grossWeight)),
    expectedFineWeight: sumWeight(held.map(v => v.netPayableWeight)),
    recoveredFineWeight: round3(recoveredFineWeight),
    refiningVariance: round3(recoveredFineWeight - expectedFromMelted),
    capitalDeployed: sumMoney(held.map(v => v.buybackValue)),
  };
}

function round3(n: number): number {
  return Number(n.toFixed(3));
}

/**
 * Validates a recovered-weight entry when a lot comes back from the refiner.
 * Deliberately permissive on the upside (a lot can assay better than the conservative
 * buyback deduction assumed) but rejects physically impossible figures.
 */
export function validateRecoveredWeight(voucher: OldGoldVoucher, recovered: number): string | null {
  const value = Number(recovered);
  if (!Number.isFinite(value) || value <= 0) {
    return 'Enter the fine gold weight actually recovered from the refiner.';
  }
  if (value > voucher.grossWeight) {
    return `Recovered fine weight cannot exceed the ${voucher.grossWeight.toFixed(3)}g gross weight originally received.`;
  }
  return null;
}
