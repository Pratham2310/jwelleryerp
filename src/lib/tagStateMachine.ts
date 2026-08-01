// Tag lifecycle state machine (PRD §5.1-5.2, Handbook Phase 3, Decision D-6).
// A Tag is the atomic sellable unit; its status must only move through legal,
// enforced transitions — never a free-text field any code path can set arbitrarily.

export type TagStatus =
  | 'RawMetal'
  | 'IssuedToKarigar'
  | 'ReceivedFromKarigar'
  | 'PendingHallmark'
  | 'Hallmarked'
  | 'InStock'
  | 'InShowcase'
  | 'OutForJobwork'
  | 'MemoOut'
  | 'TransferInTransit'
  | 'Sold'
  | 'Returned'
  | 'ReturnedToSupplier'
  | 'DamagedOrMelted';

export const ALL_TAG_STATUSES: TagStatus[] = [
  'RawMetal',
  'IssuedToKarigar',
  'ReceivedFromKarigar',
  'PendingHallmark',
  'Hallmarked',
  'InStock',
  'InShowcase',
  'OutForJobwork',
  'MemoOut',
  'TransferInTransit',
  'Sold',
  'Returned',
  'ReturnedToSupplier',
  'DamagedOrMelted',
];

export const TAG_STATUS_LABEL: Record<TagStatus, string> = {
  RawMetal: 'Raw Metal',
  IssuedToKarigar: 'Issued to Karigar',
  ReceivedFromKarigar: 'Received from Karigar',
  PendingHallmark: 'Pending Hallmark',
  Hallmarked: 'Hallmarked',
  InStock: 'In Stock',
  InShowcase: 'In Showcase',
  OutForJobwork: 'Out for Jobwork',
  MemoOut: 'Memo Out',
  TransferInTransit: 'Transfer In Transit',
  Sold: 'Sold',
  Returned: 'Returned (Pending QC)',
  ReturnedToSupplier: 'Returned to Supplier',
  DamagedOrMelted: 'Damaged / Melted',
};

// Statuses a Tag may be pulled into a bill / shown for sale from (D-7: sellable in only one place at a time).
export const SELLABLE_STATUSES: TagStatus[] = ['InStock', 'InShowcase'];

// Terminal states — no legal outgoing transition.
// `Sold` is deliberately NOT terminal: a sales return (Milestone 12) brings the physical piece
// back, and a permanently-terminal Sold would mean a returned ornament could never be resold.
// It has exactly one outgoing edge, to `Returned`, which only a credit note may trigger —
// so stock can never be silently "un-sold" without a corresponding fiscal document.
/**
 * `ReturnedToSupplier` is terminal for the same reason `DamagedOrMelted` is: the piece has
 * physically left the shop and is no longer its stock. Milestone 41 added it because a purchase
 * return had no honest state to move to — using `DamagedOrMelted` would have recorded goods sent
 * back to a dealer as goods destroyed, which is false in the data and wrong in the valuation.
 */
const TERMINAL: ReadonlySet<TagStatus> = new Set(['DamagedOrMelted', 'ReturnedToSupplier']);

const TRANSITIONS: Record<TagStatus, TagStatus[]> = {
  RawMetal: ['IssuedToKarigar', 'ReturnedToSupplier', 'DamagedOrMelted'],
  IssuedToKarigar: ['ReceivedFromKarigar', 'DamagedOrMelted'],
  ReceivedFromKarigar: ['PendingHallmark', 'InStock', 'DamagedOrMelted'],
  // `ReceivedFromKarigar` added in Milestone 24: a piece that FAILS the AHC purity test is not
  // damaged, it is under-karat. It must come back into the shop for rework and karigar
  // accountability (PRD §11.3), from where it can be re-submitted for hallmarking. Without this
  // edge the only legal exit was DamagedOrMelted, which would force melting down a rectifiable
  // piece and destroy the evidence of the shortfall.
  PendingHallmark: ['Hallmarked', 'ReceivedFromKarigar', 'ReturnedToSupplier', 'DamagedOrMelted'],
  Hallmarked: ['InStock', 'DamagedOrMelted'],
  InStock: ['InShowcase', 'OutForJobwork', 'MemoOut', 'TransferInTransit', 'Sold', 'ReturnedToSupplier', 'DamagedOrMelted'],
  InShowcase: ['InStock', 'OutForJobwork', 'MemoOut', 'TransferInTransit', 'Sold', 'DamagedOrMelted'],
  OutForJobwork: ['InStock', 'DamagedOrMelted'],
  MemoOut: ['InStock', 'Sold', 'DamagedOrMelted'],
  TransferInTransit: ['InStock', 'DamagedOrMelted'],
  Sold: ['Returned'],
  ReturnedToSupplier: [],
  // A returned piece is quarantined until staff decide: back to sellable stock after QC,
  // or written off. It is deliberately not sellable directly from `Returned`.
  Returned: ['InStock', 'DamagedOrMelted'],
  DamagedOrMelted: [],
};

export function canTransition(from: TagStatus, to: TagStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextLegalStatuses(from: TagStatus): TagStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isSellable(status: TagStatus): boolean {
  return SELLABLE_STATUSES.includes(status);
}

export class IllegalTagTransitionError extends Error {
  constructor(from: TagStatus, to: TagStatus) {
    super(`Cannot move a Tag from "${TAG_STATUS_LABEL[from]}" to "${TAG_STATUS_LABEL[to]}" — that transition is not allowed.`);
    this.name = 'IllegalTagTransitionError';
  }
}

// Throwing variant for call sites that want a guaranteed-legal result or an exception
// (UI call sites should generally prefer canTransition() + a visible validationError instead).
export function assertTransition(from: TagStatus, to: TagStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalTagTransitionError(from, to);
  }
}
