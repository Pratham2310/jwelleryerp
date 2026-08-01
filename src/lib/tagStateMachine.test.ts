import { describe, it, expect } from 'vitest';
import {
  canTransition,
  nextLegalStatuses,
  isSellable,
  assertTransition,
  IllegalTagTransitionError,
  ALL_TAG_STATUSES,
  type TagStatus,
} from './tagStateMachine';

describe('tagStateMachine.canTransition', () => {
  const legalPairs: [TagStatus, TagStatus][] = [
    ['RawMetal', 'IssuedToKarigar'],
    ['IssuedToKarigar', 'ReceivedFromKarigar'],
    ['ReceivedFromKarigar', 'PendingHallmark'],
    ['ReceivedFromKarigar', 'InStock'],
    ['PendingHallmark', 'Hallmarked'],
    ['Hallmarked', 'InStock'],
    ['InStock', 'InShowcase'],
    ['InShowcase', 'InStock'],
    ['InStock', 'OutForJobwork'],
    ['OutForJobwork', 'InStock'],
    ['InStock', 'MemoOut'],
    ['MemoOut', 'InStock'],
    ['MemoOut', 'Sold'],
    ['InStock', 'TransferInTransit'],
    ['TransferInTransit', 'InStock'],
    ['InStock', 'Sold'],
    ['InShowcase', 'Sold'],
    ['InStock', 'DamagedOrMelted'],
    // Sales return path (Milestone 12): a sold piece comes back, is quarantined, then either
    // re-enters sellable stock after QC or is written off.
    ['Sold', 'Returned'],
    ['Returned', 'InStock'],
    ['Returned', 'DamagedOrMelted'],
  ];

  it.each(legalPairs)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const illegalPairs: [TagStatus, TagStatus][] = [
    ['InStock', 'RawMetal'],
    // A sold piece can only come back via the credit-note path (Sold -> Returned), never
    // straight into sellable stock — that would let stock be un-sold with no fiscal document.
    ['Sold', 'InStock'],
    ['Sold', 'InShowcase'],
    ['DamagedOrMelted', 'InStock'],
    ['RawMetal', 'Hallmarked'],
    ['RawMetal', 'InStock'],
    ['PendingHallmark', 'InStock'],
    // Not ours to write off while it belongs to the customer; it must be returned first.
    ['Sold', 'DamagedOrMelted'],
    ['InStock', 'InStock'],
    ['TransferInTransit', 'Sold'],
    ['OutForJobwork', 'Sold'],
    // A quarantined return is not directly sellable and cannot be re-sold without QC.
    ['Returned', 'Sold'],
    ['Returned', 'InShowcase'],
  ];

  it.each(illegalPairs)('blocks %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('has exactly two terminal states, both meaning the piece has left the shop', () => {
    /**
     * `ReturnedToSupplier` joined `DamagedOrMelted` in Milestone 41. Both are terminal for the
     * same reason — the ornament is physically gone — but they are deliberately NOT the same
     * status: goods sent back to a dealer are not goods destroyed, and conflating them would
     * misstate both the stock ledger and the valuation.
     *
     * Every other status must retain a way forward, or stock could become permanently stranded.
     */
    const terminal = ALL_TAG_STATUSES.filter(s => nextLegalStatuses(s).length === 0);
    expect(terminal.sort()).toEqual(['DamagedOrMelted', 'ReturnedToSupplier']);

    for (const s of ALL_TAG_STATUSES) {
      if (terminal.includes(s)) continue;
      expect(nextLegalStatuses(s).length).toBeGreaterThan(0);
    }
  });

  it('Sold has exactly one way out — the credit-note return path', () => {
    expect(nextLegalStatuses('Sold')).toEqual(['Returned']);
  });

  it('isSellable is true only for InStock/InShowcase', () => {
    expect(isSellable('InStock')).toBe(true);
    expect(isSellable('InShowcase')).toBe(true);
    expect(isSellable('RawMetal')).toBe(false);
    expect(isSellable('Sold')).toBe(false);
    // A returned piece must pass QC back into InStock before it can be sold again
    expect(isSellable('Returned')).toBe(false);
  });

  it('assertTransition throws IllegalTagTransitionError on an illegal move, and is silent on a legal one', () => {
    expect(() => assertTransition('Sold', 'InStock')).toThrow(IllegalTagTransitionError);
    expect(() => assertTransition('InStock', 'Sold')).not.toThrow();
  });
});
