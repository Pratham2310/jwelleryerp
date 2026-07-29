import { describe, it, expect } from 'vitest';
import {
  assessHallmarkCompliance,
  findHallmarkViolations,
  applyHallmarkGate,
  validateHallmarkPolicy,
  DEFAULT_HALLMARK_POLICY,
  EXEMPTION_LABEL,
} from './hallmarkGuard';
import type { Tag, HallmarkPolicy, InvoiceItem } from '../types';

function tag(over: Partial<Tag> = {}): Tag {
  return {
    id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
    metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, stoneType: 'None',
    stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED',
    status: 'InStock', branchId: 'br-1', ...over,
  };
}

const policy = (over: Partial<HallmarkPolicy> = {}): HallmarkPolicy => ({
  ...DEFAULT_HALLMARK_POLICY, ...over,
});

describe('assessHallmarkCompliance — gold requires a HUID', () => {
  it('blocks un-hallmarked gold jewellery above the threshold', () => {
    const r = assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 10, sku: 'RNG-001' });
    expect(r.required).toBe(true);
    expect(r.compliant).toBe(false);
    expect(r.message).toMatch(/requires a BIS HUID/i);
    expect(r.message).toContain('RNG-001');
  });

  it('passes the same piece once a HUID is assigned', () => {
    const r = assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 10, huid: 'A1B2C3' });
    expect(r.required).toBe(true);
    expect(r.compliant).toBe(true);
    expect(r.huid).toBe('A1B2C3');
    expect(r.message).toBeNull();
  });

  it('treats a whitespace-only HUID as absent', () => {
    const r = assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 10, huid: '   ' });
    expect(r.compliant).toBe(false);
  });
});

describe('exemptions (PRD §11.3) — these are why the guard is not unconditional', () => {
  it('exempts silver, which is voluntary rather than mandatory hallmarking', () => {
    // Blocking a silver ring for want of a HUID would be wrong, not merely strict.
    const r = assessHallmarkCompliance({ metalType: 'Silver (999)', category: 'Rings', netWeight: 10 });
    expect(r.required).toBe(false);
    expect(r.compliant).toBe(true);
    expect(r.exemption).toBe('METAL_NOT_COVERED');
  });

  it('exempts platinum, which is separately regulated', () => {
    expect(assessHallmarkCompliance({ metalType: 'Platinum (950)', category: 'Rings', netWeight: 10 }).exemption)
      .toBe('METAL_NOT_COVERED');
  });

  it('exempts coins and bullion, which are not articles of jewellery', () => {
    // Consistent with Milestone 21 filing them under HSN 7108/7106 rather than 7113.
    const r = assessHallmarkCompliance({ metalType: 'Gold (24K)', category: 'Coins', netWeight: 10 });
    expect(r.exemption).toBe('CATEGORY_NOT_JEWELLERY');
    expect(r.compliant).toBe(true);
  });

  it('exempts a piece below the weight threshold', () => {
    const r = assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 1.5 });
    expect(r.exemption).toBe('BELOW_WEIGHT_THRESHOLD');
  });

  it('treats the threshold itself as NOT exempt', () => {
    expect(assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 2 }).compliant).toBe(false);
  });

  it('does NOT exempt on a missing weight — absent data is not a light piece', () => {
    // Zero means "not captured". Exempting it would let an unweighed piece slip through.
    expect(assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings', netWeight: 0 }).compliant).toBe(false);
    expect(assessHallmarkCompliance({ metalType: 'Gold (22K)', category: 'Rings' }).compliant).toBe(false);
  });

  it('exempts everything when the shop is below the turnover threshold', () => {
    const r = assessHallmarkCompliance(
      { metalType: 'Gold (22K)', category: 'Rings', netWeight: 50 },
      policy({ shopExemptByTurnover: true })
    );
    expect(r.exemption).toBe('SHOP_TURNOVER');
    expect(r.compliant).toBe(true);
  });

  it('reports the exemption rather than "no HUID" when both apply', () => {
    // The operator should be told why it is allowed, not why it might not have been.
    const r = assessHallmarkCompliance({ metalType: 'Silver (999)', category: 'Rings', netWeight: 10 });
    expect(r.exemption).toBe('METAL_NOT_COVERED');
    expect(r.message).toBeNull();
  });

  it('honours a reconfigured threshold, since the rules change with notifications', () => {
    const r = assessHallmarkCompliance(
      { metalType: 'Gold (22K)', category: 'Rings', netWeight: 4 },
      policy({ minimumWeightGrams: 5 })
    );
    expect(r.exemption).toBe('BELOW_WEIGHT_THRESHOLD');
  });

  it('labels every exemption for display', () => {
    expect(Object.keys(EXEMPTION_LABEL)).toHaveLength(4);
    expect(EXEMPTION_LABEL.METAL_NOT_COVERED).toMatch(/not under mandatory/i);
  });
});

describe('findHallmarkViolations across a bill', () => {
  const tags = [
    tag({ id: 'g1', sku: 'RNG-001', metalType: 'Gold (22K)', netWeight: 10 }),
    tag({ id: 'g2', sku: 'NEC-002', metalType: 'Gold (22K)', netWeight: 20, huid: 'A1B2C3' }),
    tag({ id: 's1', sku: 'SLV-003', metalType: 'Silver (999)', netWeight: 10 }),
    tag({ id: 'g3', sku: 'BGL-004', metalType: 'Gold (22K)', netWeight: 30 }),
  ];
  const line = (itemId?: string): Partial<InvoiceItem> => ({ itemId });

  it('reports every offending line, not just the first', () => {
    // One trip to the hallmarking centre beats discovering the pieces one at a time.
    const v = findHallmarkViolations([line('g1'), line('g2'), line('g3')], tags);
    expect(v.map(x => x.sku)).toEqual(['RNG-001', 'BGL-004']);
    expect(v.map(x => x.lineIndex)).toEqual([0, 2]);
  });

  it('passes a bill of hallmarked and exempt pieces', () => {
    expect(findHallmarkViolations([line('g2'), line('s1')], tags)).toEqual([]);
  });

  it('skips manually-typed lines that carry no tag', () => {
    // A custom line has nothing to hallmark and no HUID to look up.
    expect(findHallmarkViolations([line(undefined), { name: 'Custom bangle' }], tags)).toEqual([]);
  });

  it('skips a line whose tag no longer exists rather than crashing', () => {
    expect(findHallmarkViolations([line('ghost')], tags)).toEqual([]);
  });

  it('reports an empty bill as clean', () => {
    expect(findHallmarkViolations([], tags)).toEqual([]);
  });
});

describe('applyHallmarkGate — enforcement mode', () => {
  const violations = [
    { lineIndex: 0, sku: 'RNG-001', message: 'RNG-001 is Gold (22K) and requires a BIS HUID, but none is assigned. Send it for hallmarking before sale.' },
  ];
  const two = [...violations, { lineIndex: 2, sku: 'BGL-004', message: 'BGL-004 ...' }];

  it('stops checkout in BLOCK mode', () => {
    const o = applyHallmarkGate(violations, policy({ enforcement: 'BLOCK' }));
    expect(o.blocked).toBe(true);
    expect(o.warned).toBe(false);
    expect(o.message).toMatch(/requires a BIS HUID/i);
  });

  it('lets the sale through in WARN mode but says so', () => {
    const o = applyHallmarkGate(violations, policy({ enforcement: 'WARN' }));
    expect(o.blocked).toBe(false);
    expect(o.warned).toBe(true);
    expect(o.message).toMatch(/compliance risk/i);
  });

  it('says nothing in OFF mode', () => {
    const o = applyHallmarkGate(violations, policy({ enforcement: 'OFF' }));
    expect(o.blocked).toBe(false);
    expect(o.warned).toBe(false);
    expect(o.message).toBeNull();
  });

  it('still REPORTS the violations in WARN and OFF mode', () => {
    // Detection is separate from enforcement: relaxing the till must not blind the shop to its
    // own exposure, or a WARN-mode shop would report itself as fully compliant.
    expect(applyHallmarkGate(violations, policy({ enforcement: 'WARN' })).violations).toHaveLength(1);
    expect(applyHallmarkGate(violations, policy({ enforcement: 'OFF' })).violations).toHaveLength(1);
  });

  it('names every piece when several are involved', () => {
    const o = applyHallmarkGate(two, policy({ enforcement: 'BLOCK' }));
    expect(o.message).toContain('RNG-001');
    expect(o.message).toContain('BGL-004');
    expect(o.message).toMatch(/2 pieces/);
  });

  it('is a no-op on a clean bill in every mode', () => {
    for (const mode of ['BLOCK', 'WARN', 'OFF'] as const) {
      const o = applyHallmarkGate([], policy({ enforcement: mode }));
      expect(o.blocked).toBe(false);
      expect(o.message).toBeNull();
    }
  });
});

describe('validateHallmarkPolicy', () => {
  it('accepts the shipped default', () => {
    expect(validateHallmarkPolicy(DEFAULT_HALLMARK_POLICY)).toBeNull();
  });

  it('rejects a negative or non-numeric threshold', () => {
    expect(validateHallmarkPolicy({ ...DEFAULT_HALLMARK_POLICY, minimumWeightGrams: -1 })).toMatch(/valid minimum weight/i);
    expect(validateHallmarkPolicy({ ...DEFAULT_HALLMARK_POLICY, minimumWeightGrams: NaN })).toMatch(/valid minimum weight/i);
  });

  it('rejects a threshold that would exempt the whole catalogue', () => {
    expect(validateHallmarkPolicy({ ...DEFAULT_HALLMARK_POLICY, minimumWeightGrams: 500 })).toMatch(/exempt almost everything/i);
  });

  it('requires an enforcement mode', () => {
    expect(validateHallmarkPolicy({ minimumWeightGrams: 2 })).toMatch(/how the guard should behave/i);
  });

  it('accepts a zero threshold, which means nothing is weight-exempt', () => {
    expect(validateHallmarkPolicy({ ...DEFAULT_HALLMARK_POLICY, minimumWeightGrams: 0 })).toBeNull();
  });
});
