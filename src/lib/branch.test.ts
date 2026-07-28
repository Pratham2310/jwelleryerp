import { describe, it, expect } from 'vitest';
import {
  getActiveBranch,
  primaryBranchId,
  belongsToBranch,
  scopeToBranch,
  resolveMetalRate,
  hasRateOverride,
  nextBranchInvoiceNumber,
  isIntraState,
  validateBranch,
} from './branch';
import type { Branch, MetalRate } from '../types';

function branch(over: Partial<Branch> = {}): Branch {
  return {
    id: 'br-1',
    branchCode: 'MUM-01',
    name: 'Mumbai BST Showroom',
    address: 'Zaveri Bazaar, Mumbai',
    gstin: '27AACCS9948H1Z1',
    stateCode: '27',
    invoiceSeriesPrefix: 'INV',
    defaultStockOwnershipType: 'OWNED',
    isActive: true,
    ...over,
  };
}

const rates: MetalRate[] = [
  { id: 'r1', metalType: 'Gold (22K)', purity: '91.6%', ratePerGram: 6650, change24h: 0, history24h: [] },
  { id: 'r2', metalType: 'Gold (18K)', purity: '75.0%', ratePerGram: 5440, change24h: 0, history24h: [] },
];

// Minimal in-memory Storage stand-in so sequence tests don't touch real localStorage
function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe('getActiveBranch', () => {
  it('returns null when no branches exist', () => {
    expect(getActiveBranch([], 'br-1')).toBeNull();
  });

  it('returns the selected branch', () => {
    const list = [branch({ id: 'a' }), branch({ id: 'b', branchCode: 'PUN-01', invoiceSeriesPrefix: 'PUN' })];
    expect(getActiveBranch(list, 'b')!.id).toBe('b');
  });

  it('falls back to the first branch when the selection is stale', () => {
    const list = [branch({ id: 'a' })];
    expect(getActiveBranch(list, 'deleted-branch')!.id).toBe('a');
    expect(primaryBranchId(list)).toBe('a');
  });
});

describe('branch scoping', () => {
  const fallback = 'br-1';

  it('shows everything when no branch is selected yet', () => {
    expect(belongsToBranch({ branchId: 'br-2' }, null, fallback)).toBe(true);
  });

  it('matches records explicitly in the branch', () => {
    expect(belongsToBranch({ branchId: 'br-2' }, 'br-2', fallback)).toBe(true);
    expect(belongsToBranch({ branchId: 'br-2' }, 'br-1', fallback)).toBe(false);
  });

  it('attributes legacy records with no branchId to the primary branch', () => {
    // Showing them everywhere would double-count real stock; hiding them would make a
    // user's existing data vanish. Attribution is the only non-destructive option.
    expect(belongsToBranch({}, 'br-1', 'br-1')).toBe(true);
    expect(belongsToBranch({}, 'br-2', 'br-1')).toBe(false);
  });

  it('filters a collection to one branch', () => {
    const items = [
      { id: 1, branchId: 'br-1' },
      { id: 2, branchId: 'br-2' },
      { id: 3 }, // legacy
    ];
    expect(scopeToBranch(items, 'br-1', 'br-1').map(i => i.id)).toEqual([1, 3]);
    expect(scopeToBranch(items, 'br-2', 'br-1').map(i => i.id)).toEqual([2]);
  });

  it('returns everything unfiltered when branchId is null', () => {
    const items = [{ branchId: 'br-1' }, { branchId: 'br-2' }];
    expect(scopeToBranch(items, null, 'br-1')).toHaveLength(2);
  });
});

describe('resolveMetalRate (D-1: HQ rate with a permissioned branch override)', () => {
  it('uses the HQ rate when the branch has no override', () => {
    expect(resolveMetalRate(rates, branch(), 'Gold (22K)')).toBe(6650);
    expect(hasRateOverride(branch(), 'Gold (22K)')).toBe(false);
  });

  it('prefers a branch override when present', () => {
    const b = branch({ rateOverrides: { 'Gold (22K)': 6700 } });
    expect(resolveMetalRate(rates, b, 'Gold (22K)')).toBe(6700);
    expect(hasRateOverride(b, 'Gold (22K)')).toBe(true);
  });

  it('only overrides the metal it names', () => {
    const b = branch({ rateOverrides: { 'Gold (22K)': 6700 } });
    expect(resolveMetalRate(rates, b, 'Gold (18K)')).toBe(5440);
  });

  it('ignores a zero or negative override rather than zeroing the rate', () => {
    const b = branch({ rateOverrides: { 'Gold (22K)': 0 } });
    expect(resolveMetalRate(rates, b, 'Gold (22K)')).toBe(6650);
  });

  it('returns 0 for an unknown metal rather than throwing', () => {
    expect(resolveMetalRate(rates, branch(), 'Palladium')).toBe(0);
  });
});

describe('nextBranchInvoiceNumber — closes KNOWN_ISSUES #11(b)', () => {
  const now = new Date(2026, 6, 1);

  it('uses the branch series prefix', () => {
    const st = memStorage();
    expect(nextBranchInvoiceNumber(branch({ invoiceSeriesPrefix: 'MUM' }), now, st)).toBe('MUM-2026-1001');
  });

  it('keeps each branch on its OWN consecutive series (GST Rule 46, per GSTIN)', () => {
    const st = memStorage();
    const mum = branch({ id: 'a', invoiceSeriesPrefix: 'MUM' });
    const pun = branch({ id: 'b', invoiceSeriesPrefix: 'PUN', branchCode: 'PUN-01' });

    expect(nextBranchInvoiceNumber(mum, now, st)).toBe('MUM-2026-1001');
    expect(nextBranchInvoiceNumber(pun, now, st)).toBe('PUN-2026-1001');
    expect(nextBranchInvoiceNumber(mum, now, st)).toBe('MUM-2026-1002');
    // Pune's series must be unaffected by Mumbai's activity
    expect(nextBranchInvoiceNumber(pun, now, st)).toBe('PUN-2026-1002');
  });

  it('restarts the series each financial year', () => {
    const st = memStorage();
    nextBranchInvoiceNumber(branch(), new Date(2026, 6, 1), st);
    expect(nextBranchInvoiceNumber(branch(), new Date(2027, 6, 1), st)).toBe('INV-2027-1001');
  });

  it('falls back to a generic prefix when no branch is set', () => {
    expect(nextBranchInvoiceNumber(null, now, memStorage())).toBe('INV-2026-1001');
  });
});

describe('isIntraState — feeds the Milestone 21 CGST/SGST vs IGST split', () => {
  it('is true for two branches in the same state', () => {
    expect(isIntraState(branch({ stateCode: '27' }), branch({ id: 'b', stateCode: '27' }))).toBe(true);
  });

  it('is false across states', () => {
    expect(isIntraState(branch({ stateCode: '27' }), branch({ id: 'b', stateCode: '29' }))).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(isIntraState(branch(), null)).toBe(false);
  });
});

describe('validateBranch', () => {
  const existing = [branch({ id: 'br-1', branchCode: 'MUM-01', invoiceSeriesPrefix: 'MUM' })];

  it('accepts a well-formed new branch', () => {
    expect(validateBranch(
      { id: 'br-2', name: 'Pune', branchCode: 'PUN-01', stateCode: '27', invoiceSeriesPrefix: 'PUN' },
      existing
    )).toBeNull();
  });

  it('requires the fields downstream milestones depend on', () => {
    expect(validateBranch({ branchCode: 'X', stateCode: '27', invoiceSeriesPrefix: 'X' }, [])).toMatch(/name/i);
    expect(validateBranch({ name: 'X', stateCode: '27', invoiceSeriesPrefix: 'X' }, [])).toMatch(/code/i);
    expect(validateBranch({ name: 'X', branchCode: 'X', invoiceSeriesPrefix: 'X' }, [])).toMatch(/State code/i);
    expect(validateBranch({ name: 'X', branchCode: 'X', stateCode: '27' }, [])).toMatch(/series prefix/i);
  });

  it('rejects a duplicate branch code', () => {
    expect(validateBranch(
      { id: 'br-2', name: 'Other', branchCode: 'mum-01', stateCode: '27', invoiceSeriesPrefix: 'OTH' },
      existing
    )).toMatch(/code is already in use/i);
  });

  it('rejects a duplicate invoice series prefix — it would interleave two GSTINs', () => {
    expect(validateBranch(
      { id: 'br-2', name: 'Other', branchCode: 'OTH-01', stateCode: '27', invoiceSeriesPrefix: 'mum' },
      existing
    )).toMatch(/series prefix is already used/i);
  });

  it('lets a branch keep its own code and prefix when edited', () => {
    expect(validateBranch(
      { id: 'br-1', name: 'Mumbai Renamed', branchCode: 'MUM-01', stateCode: '27', invoiceSeriesPrefix: 'MUM' },
      existing
    )).toBeNull();
  });
});
