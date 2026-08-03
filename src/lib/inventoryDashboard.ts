/**
 * Inventory Dashboard analytics (Milestone 44, PRD §14.4).
 *
 * Distinct from the sales Dashboard (M13): that one answers "how is the shop trading", this one
 * answers "what is sitting on the shelves, how old is it, and whose is it".
 *
 * ─── What counts as stock, and why the distinction matters ────────────────────────────
 * "Stock" is not one number. A piece out on memo is still the shop's asset but cannot be sold to
 * a walk-in; a piece in transit belongs to neither branch's floor; a piece with a karigar is
 * metal the shop owns but does not hold. Rolling these into a single figure produces a number
 * that is wrong for every question anyone actually asks, so the tiles separate:
 *
 *   - **Sellable** — what a customer could buy today.
 *   - **Held, not sellable** — the shop's asset, elsewhere in the pipeline.
 *   - **Gone** — sold, returned to supplier, written off, melted. Never in a stock figure.
 *
 * ─── Financed stock is the exposure worth surfacing ───────────────────────────────────
 * GML (gold metal loan) and consignment stock sit on the shelf looking exactly like owned stock,
 * but the shop does not own it and owes either metal or money against it. A valuation that does
 * not separate them overstates what the business is actually worth (Handbook §1.6 / D-3).
 *
 * Everything here derives from `Tag[]` on each call. Nothing is stored, so a tile can never
 * disagree with the stock it is describing — the same rule as karigar balances (M16), metal
 * rates (M48) and the reports hub (M30).
 */

import type { Tag, MetalRate, ItemCategory } from '../types';
import { isSellable, TAG_STATUS_LABEL, type TagStatus } from './tagStateMachine';
import { daysHeld, ageBucketOf, type AgeBucket } from './reports';
import { roundMoney, roundWeight, sumMoney, sumWeight } from './money';

/** Statuses where the shop still owns the piece but it is not on the sales floor. */
export const HELD_NOT_SELLABLE: TagStatus[] = [
  'RawMetal', 'IssuedToKarigar', 'ReceivedFromKarigar', 'PendingHallmark',
  'Hallmarked', 'OutForJobwork', 'MemoOut', 'TransferInTransit', 'Returned',
];

/** Statuses where the piece has left the business and must never appear in a stock figure. */
export const GONE: TagStatus[] = ['Sold', 'ReturnedToSupplier', 'DamagedOrMelted'];

export function isHeldNotSellable(status: TagStatus): boolean {
  return HELD_NOT_SELLABLE.includes(status);
}

export function isOnHand(status: TagStatus): boolean {
  return isSellable(status) || isHeldNotSellable(status);
}

/** Metal + stone. Making charge is excluded: unsold stock has not realised its value addition. */
export function valueOf(tag: Tag, rates: MetalRate[]): number {
  const rate = rates.find(r => r.metalType === tag.metalType)?.ratePerGram ?? 0;
  return tag.netWeight * rate + (tag.stoneCharge || 0);
}

export function valueOfAll(tags: Tag[], rates: MetalRate[]): number {
  return roundMoney(sumMoney(tags.map(t => valueOf(t, rates))));
}

/* ─────────────────────────────── Headline ─────────────────────────────── */

export interface InventoryHeadline {
  sellablePieces: number;
  sellableWeight: number;
  sellableValue: number;
  heldNotSellablePieces: number;
  heldNotSellableWeight: number;
  heldNotSellableValue: number;
  /** Everything the shop physically owns or is owed, sellable or not. */
  totalOnHandValue: number;
  /** Of the above, the part the shop does not actually own. */
  financedValue: number;
  /** What the business is genuinely worth on the shelf: on-hand less financed. */
  ownedValue: number;
}

export function inventoryHeadline(tags: Tag[], rates: MetalRate[]): InventoryHeadline {
  const sellable = tags.filter(t => isSellable(t.status));
  const held = tags.filter(t => isHeldNotSellable(t.status));
  const onHand = tags.filter(t => isOnHand(t.status));
  const financed = onHand.filter(t => t.stockOwnershipType !== 'OWNED');

  const totalOnHandValue = valueOfAll(onHand, rates);
  const financedValue = valueOfAll(financed, rates);

  return {
    sellablePieces: sellable.length,
    sellableWeight: roundWeight(sumWeight(sellable.map(t => t.netWeight))),
    sellableValue: valueOfAll(sellable, rates),
    heldNotSellablePieces: held.length,
    heldNotSellableWeight: roundWeight(sumWeight(held.map(t => t.netWeight))),
    heldNotSellableValue: valueOfAll(held, rates),
    totalOnHandValue,
    financedValue,
    ownedValue: roundMoney(totalOnHandValue - financedValue),
  };
}

/* ─────────────────────────────── Breakdowns ─────────────────────────────── */

export interface StockSlice {
  key: string;
  label: string;
  pieces: number;
  netWeight: number;
  value: number;
  /** Share of on-hand value, for the bar widths. */
  sharePercent: number;
}

function slice(
  tags: Tag[], rates: MetalRate[], keyOf: (t: Tag) => string, labelOf: (k: string) => string
): StockSlice[] {
  const onHand = tags.filter(t => isOnHand(t.status));
  const total = valueOfAll(onHand, rates);
  const keys = [...new Set(onHand.map(keyOf))];

  return keys
    .map(key => {
      const list = onHand.filter(t => keyOf(t) === key);
      const value = valueOfAll(list, rates);
      return {
        key,
        label: labelOf(key),
        pieces: list.length,
        netWeight: roundWeight(sumWeight(list.map(t => t.netWeight))),
        value,
        sharePercent: total > 0 ? roundWeight((value / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function stockByPurity(tags: Tag[], rates: MetalRate[]): StockSlice[] {
  return slice(tags, rates, t => t.metalType, k => k);
}

export function stockByCategory(tags: Tag[], rates: MetalRate[]): StockSlice[] {
  return slice(tags, rates, t => t.category as string, k => k);
}

export function stockByOwnership(tags: Tag[], rates: MetalRate[]): StockSlice[] {
  const LABEL: Record<string, string> = {
    OWNED: 'Owned outright',
    GML_FINANCED: 'Gold metal loan',
    CONSIGNMENT: 'Consignment',
  };
  return slice(tags, rates, t => t.stockOwnershipType, k => LABEL[k] ?? k);
}

/** Lifecycle distribution across every status a piece is currently in, including the gone ones. */
export function lifecycleDistribution(tags: Tag[]): { status: TagStatus; label: string; pieces: number }[] {
  const statuses = [...new Set(tags.map(t => t.status))] as TagStatus[];
  return statuses
    .map(status => ({
      status,
      label: TAG_STATUS_LABEL[status] ?? status,
      pieces: tags.filter(t => t.status === status).length,
    }))
    .sort((a, b) => b.pieces - a.pieces);
}

/* ─────────────────────────────── Ageing ─────────────────────────────── */

export interface AgeingSlice {
  bucket: AgeBucket;
  label: string;
  pieces: number;
  netWeight: number;
  value: number;
}

const BUCKET_LABEL: Record<AgeBucket, string> = {
  '0-90': 'Under 90 days',
  '91-180': '91–180 days',
  '181-365': '181–365 days',
  '365+': 'Over a year',
  unknown: 'Undated',
};

/**
 * Ageing across everything on hand, not just the sellable slice that `reports.inventoryAgeing`
 * covers: a piece that has sat with a karigar for eight months is exactly the capital this
 * report exists to surface, and excluding it would hide the worst cases.
 */
export function inventoryAgeingOnHand(
  tags: Tag[], rates: MetalRate[], today: string = new Date().toISOString().slice(0, 10)
): AgeingSlice[] {
  const onHand = tags.filter(t => isOnHand(t.status));
  const buckets: AgeBucket[] = ['0-90', '91-180', '181-365', '365+', 'unknown'];

  return buckets
    .map(bucket => {
      const list = onHand.filter(t => ageBucketOf(daysHeld(t.taggedOn, today)) === bucket);
      return {
        bucket,
        label: BUCKET_LABEL[bucket],
        pieces: list.length,
        netWeight: roundWeight(sumWeight(list.map(t => t.netWeight))),
        value: valueOfAll(list, rates),
      };
    })
    .filter(r => r.pieces > 0);
}

/**
 * Capital in stock older than the threshold. Undated pieces are counted as *unknown*, never as
 * new — defaulting them to today would show zero old stock and hide the exact problem the tile
 * exists to surface (the same rule `Tag.taggedOn` documents).
 */
export function slowMovingCapital(
  slices: AgeingSlice[], thresholdDays: 90 | 180 = 180
): { value: number; pieces: number; undatedPieces: number } {
  const slow: AgeBucket[] = thresholdDays === 90
    ? ['91-180', '181-365', '365+']
    : ['181-365', '365+'];
  const rows = slices.filter(s => slow.includes(s.bucket));
  return {
    value: roundMoney(sumMoney(rows.map(r => r.value))),
    pieces: rows.reduce((n, r) => n + r.pieces, 0),
    undatedPieces: slices.find(s => s.bucket === 'unknown')?.pieces ?? 0,
  };
}

/* ─────────────────────────────── Reconciliation ─────────────────────────────── */

export interface InventoryCheck {
  label: string;
  passes: boolean;
  detail: string;
}

/**
 * Executable checks, in the spirit of `reconcileReports()` (M30). The milestone's criterion is
 * "every tile reconciles against the underlying Tag[]", so the screen proves it rather than
 * asserting it.
 */
export function reconcileInventory(tags: Tag[], rates: MetalRate[]): InventoryCheck[] {
  const head = inventoryHeadline(tags, rates);
  const onHand = tags.filter(t => isOnHand(t.status));
  const purity = stockByPurity(tags, rates);
  const ageing = inventoryAgeingOnHand(tags, rates);

  const sliceTotal = roundMoney(sumMoney(purity.map(p => p.value)));
  const ageingTotal = roundMoney(sumMoney(ageing.map(a => a.value)));
  const ageingPieces = ageing.reduce((n, a) => n + a.pieces, 0);

  return [
    {
      label: 'Purity breakdown ties to on-hand value',
      passes: sliceTotal === head.totalOnHandValue,
      detail: `₹${sliceTotal.toLocaleString('en-IN')} vs ₹${head.totalOnHandValue.toLocaleString('en-IN')}`,
    },
    {
      label: 'Ageing buckets cover every on-hand piece',
      passes: ageingPieces === onHand.length,
      detail: `${ageingPieces} bucketed vs ${onHand.length} on hand`,
    },
    {
      label: 'Ageing value ties to on-hand value',
      passes: ageingTotal === head.totalOnHandValue,
      detail: `₹${ageingTotal.toLocaleString('en-IN')} vs ₹${head.totalOnHandValue.toLocaleString('en-IN')}`,
    },
    {
      label: 'Owned plus financed equals on-hand',
      passes: roundMoney(head.ownedValue + head.financedValue) === head.totalOnHandValue,
      detail: `₹${head.ownedValue.toLocaleString('en-IN')} owned + ₹${head.financedValue.toLocaleString('en-IN')} financed`,
    },
    {
      label: 'Sold and written-off pieces are excluded from stock',
      passes: !onHand.some(t => GONE.includes(t.status)),
      detail: `${tags.filter(t => GONE.includes(t.status)).length} piece(s) correctly excluded`,
    },
  ];
}

export type { ItemCategory };
