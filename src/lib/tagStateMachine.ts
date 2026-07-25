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
  DamagedOrMelted: 'Damaged / Melted',
};

// Statuses a Tag may be pulled into a bill / shown for sale from (D-7: sellable in only one place at a time).
export const SELLABLE_STATUSES: TagStatus[] = ['InStock', 'InShowcase'];

// Terminal states — no legal outgoing transition.
const TERMINAL: ReadonlySet<TagStatus> = new Set(['Sold', 'DamagedOrMelted']);

const TRANSITIONS: Record<TagStatus, TagStatus[]> = {
  RawMetal: ['IssuedToKarigar', 'DamagedOrMelted'],
  IssuedToKarigar: ['ReceivedFromKarigar', 'DamagedOrMelted'],
  ReceivedFromKarigar: ['PendingHallmark', 'InStock', 'DamagedOrMelted'],
  PendingHallmark: ['Hallmarked', 'DamagedOrMelted'],
  Hallmarked: ['InStock', 'DamagedOrMelted'],
  InStock: ['InShowcase', 'OutForJobwork', 'MemoOut', 'TransferInTransit', 'Sold', 'DamagedOrMelted'],
  InShowcase: ['InStock', 'OutForJobwork', 'MemoOut', 'TransferInTransit', 'Sold', 'DamagedOrMelted'],
  OutForJobwork: ['InStock', 'DamagedOrMelted'],
  MemoOut: ['InStock', 'Sold', 'DamagedOrMelted'],
  TransferInTransit: ['InStock', 'DamagedOrMelted'],
  Sold: [],
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
