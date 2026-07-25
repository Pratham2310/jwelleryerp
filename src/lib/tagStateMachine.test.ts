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
  ];

  it.each(legalPairs)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const illegalPairs: [TagStatus, TagStatus][] = [
    ['InStock', 'RawMetal'],
    ['Sold', 'InStock'],
    ['DamagedOrMelted', 'InStock'],
    ['RawMetal', 'Hallmarked'],
    ['RawMetal', 'InStock'],
    ['PendingHallmark', 'InStock'],
    ['Sold', 'DamagedOrMelted'],
    ['InStock', 'InStock'],
    ['TransferInTransit', 'Sold'],
    ['OutForJobwork', 'Sold'],
  ];

  it.each(illegalPairs)('blocks %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('every status is reachable from RawMetal to a terminal state, and terminal states have no outgoing transitions', () => {
    expect(nextLegalStatuses('Sold')).toEqual([]);
    expect(nextLegalStatuses('DamagedOrMelted')).toEqual([]);
    for (const s of ALL_TAG_STATUSES) {
      if (s === 'Sold' || s === 'DamagedOrMelted') continue;
      expect(nextLegalStatuses(s).length).toBeGreaterThan(0);
    }
  });

  it('isSellable is true only for InStock/InShowcase', () => {
    expect(isSellable('InStock')).toBe(true);
    expect(isSellable('InShowcase')).toBe(true);
    expect(isSellable('RawMetal')).toBe(false);
    expect(isSellable('Sold')).toBe(false);
  });

  it('assertTransition throws IllegalTagTransitionError on an illegal move, and is silent on a legal one', () => {
    expect(() => assertTransition('Sold', 'InStock')).toThrow(IllegalTagTransitionError);
    expect(() => assertTransition('InStock', 'Sold')).not.toThrow();
  });
});
