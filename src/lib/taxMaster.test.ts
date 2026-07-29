import { describe, it, expect } from 'vitest';
import {
  resolveTaxRate,
  resolveGstRatePercent,
  defaultHsnForLine,
  determineSupplyType,
  splitGst,
  gstComponentLabels,
  computeRoundOff,
  validateTaxRate,
  supersedeTaxRate,
  summariseByHsn,
  HSN,
  FALLBACK_COMPOSITE_RATE_PERCENT,
} from './taxMaster';
import type { TaxRate } from '../types';

function rate(over: Partial<TaxRate> = {}): TaxRate {
  return {
    id: 'tr1',
    hsnCode: HSN.JEWELLERY,
    description: 'Gold jewellery',
    gstRatePercent: 3,
    effectiveFrom: '2020-01-01',
    ...over,
  };
}

describe('resolveTaxRate — effective-date versioning (PRD §9.2)', () => {
  const rates: TaxRate[] = [
    rate({ id: 'old', gstRatePercent: 3, effectiveFrom: '2017-07-01', effectiveTo: '2024-03-31' }),
    rate({ id: 'new', gstRatePercent: 5, effectiveFrom: '2024-04-01' }),
  ];

  it('resolves the row in force on the given date, not the latest row', () => {
    // This is the whole point of versioning: re-printing an old invoice must not
    // silently re-tax it at today's rate.
    expect(resolveTaxRate(HSN.JEWELLERY, rates, '2023-06-15')?.id).toBe('old');
    expect(resolveTaxRate(HSN.JEWELLERY, rates, '2025-06-15')?.id).toBe('new');
  });

  it('treats both window boundaries as inclusive', () => {
    expect(resolveTaxRate(HSN.JEWELLERY, rates, '2024-03-31')?.id).toBe('old');
    expect(resolveTaxRate(HSN.JEWELLERY, rates, '2024-04-01')?.id).toBe('new');
  });

  it('returns null before any row took effect', () => {
    expect(resolveTaxRate(HSN.JEWELLERY, rates, '2010-01-01')).toBeNull();
  });

  it('returns null for an HSN that has no rows at all', () => {
    expect(resolveTaxRate('9999', rates, '2025-01-01')).toBeNull();
  });

  it('prefers the later effectiveFrom when windows overlap, so a correction wins', () => {
    const overlapping = [
      rate({ id: 'a', gstRatePercent: 3, effectiveFrom: '2024-01-01' }),
      rate({ id: 'b', gstRatePercent: 4, effectiveFrom: '2024-06-01' }),
    ];
    expect(resolveTaxRate(HSN.JEWELLERY, overlapping, '2024-09-01')?.id).toBe('b');
  });

  it('falls back to the composite jewellery rate when nothing resolves', () => {
    expect(resolveGstRatePercent('9999', rates, '2025-01-01')).toBe(FALLBACK_COMPOSITE_RATE_PERCENT);
    expect(resolveGstRatePercent(HSN.JEWELLERY, rates, '2025-01-01')).toBe(5);
  });
});

describe('defaultHsnForLine', () => {
  it('bills ornaments under 7113 regardless of metal', () => {
    expect(defaultHsnForLine({ metalType: 'Gold (22K)', category: 'Rings' })).toBe(HSN.JEWELLERY);
    expect(defaultHsnForLine({ metalType: 'Silver (999)', category: 'Chains' })).toBe(HSN.JEWELLERY);
  });

  it('separates bullion from ornaments, since GSTR-1 needs an HSN-wise summary', () => {
    // Same 3% rate, but a different HSN — the return would be wrong otherwise.
    expect(defaultHsnForLine({ metalType: 'Gold (24K)', category: 'Coins' })).toBe(HSN.GOLD_BULLION);
    expect(defaultHsnForLine({ metalType: 'Silver (999)', category: 'Coins' })).toBe(HSN.SILVER_BULLION);
  });

  it('keeps a diamond-set ornament on the composite jewellery HSN pending CA sign-off', () => {
    // HANDOFF.md item 1. Reassigning this to 7102 would halve the tax on every
    // diamond sale — it must not happen without an explicit decision.
    expect(defaultHsnForLine({ metalType: 'Gold (18K)', category: 'Earrings' })).toBe(HSN.JEWELLERY);
    expect(defaultHsnForLine({ metalType: 'Gold (18K)', category: 'Earrings' })).not.toBe(HSN.DIAMOND);
  });

  it('defaults to jewellery when the line carries no classification at all', () => {
    expect(defaultHsnForLine({})).toBe(HSN.JEWELLERY);
  });

  it('lets an explicit Item Design HSN win over the derived one', () => {
    // The accountant's classification on the design master is authoritative.
    expect(defaultHsnForLine({ hsnCode: '7103', category: 'Coins', metalType: 'Gold (24K)' })).toBe('7103');
  });

  it('ignores a blank explicit code and falls back to deriving', () => {
    expect(defaultHsnForLine({ hsnCode: '   ', category: 'Coins', metalType: 'Gold (24K)' })).toBe(HSN.GOLD_BULLION);
  });
});

describe('determineSupplyType (PRD §7.3)', () => {
  it('is intra-state when the customer is in the branch state', () => {
    expect(determineSupplyType('27', '27')).toBe('INTRA_STATE');
  });

  it('is inter-state when the states differ', () => {
    expect(determineSupplyType('27', '29')).toBe('INTER_STATE');
  });

  it('defaults an unregistered / stateless customer to the shop state', () => {
    // PRD §7.3 says so explicitly, and it matters: most retail buyers are walk-ins,
    // and treating those as inter-state would misfile every counter sale.
    expect(determineSupplyType('27', undefined)).toBe('INTRA_STATE');
    expect(determineSupplyType('27', '')).toBe('INTRA_STATE');
    expect(determineSupplyType('27', '   ')).toBe('INTRA_STATE');
  });

  it('defaults to intra-state when the branch itself has no state configured', () => {
    expect(determineSupplyType(undefined, '29')).toBe('INTRA_STATE');
  });
});

describe('splitGst', () => {
  it('splits an intra-state sale into CGST + SGST', () => {
    expect(splitGst(3000, 'INTRA_STATE')).toEqual({ cgst: 1500, sgst: 1500, igst: 0, total: 3000 });
  });

  it('puts the whole tax in IGST for an inter-state sale', () => {
    expect(splitGst(3000, 'INTER_STATE')).toEqual({ cgst: 0, sgst: 0, igst: 3000, total: 3000 });
  });

  it('keeps CGST + SGST exactly equal to the tax charged on an odd amount', () => {
    // Rounding each half independently would give 4342 + 4342 = 8684, a rupee more
    // than the invoice's own GST total, and GSTR-1 would not reconcile.
    const s = splitGst(8683, 'INTRA_STATE');
    expect(s.cgst + s.sgst).toBe(8683);
    expect(s).toEqual({ cgst: 4342, sgst: 4341, igst: 0, total: 8683 });
  });

  it('handles zero tax', () => {
    expect(splitGst(0, 'INTRA_STATE')).toEqual({ cgst: 0, sgst: 0, igst: 0, total: 0 });
  });
});

describe('gstComponentLabels', () => {
  it('halves the rate for the intra-state components', () => {
    expect(gstComponentLabels(3, 'INTRA_STATE')).toEqual(['CGST @1.5%', 'SGST @1.5%']);
  });

  it('shows the full rate for IGST', () => {
    expect(gstComponentLabels(3, 'INTER_STATE')).toEqual(['IGST @3%']);
  });

  it('does not print trailing zeros on a whole-number half', () => {
    expect(gstComponentLabels(6, 'INTRA_STATE')).toEqual(['CGST @3%', 'SGST @3%']);
  });
});

describe('computeRoundOff (PRD §7.3)', () => {
  it('absorbs the paise left by GST on a whole-rupee base', () => {
    // PRD §17: taxable 2,89,440 + GST 8,683.20 = 2,98,123.20 -> 2,98,123
    expect(computeRoundOff(298123.2)).toEqual({ roundedTotal: 298123, roundOff: -0.2 });
  });

  it('rounds up and reports a positive round-off', () => {
    expect(computeRoundOff(1000.6)).toEqual({ roundedTotal: 1001, roundOff: 0.4 });
  });

  it('is zero on an already-whole total', () => {
    expect(computeRoundOff(1000)).toEqual({ roundedTotal: 1000, roundOff: 0 });
  });
});

describe('validateTaxRate', () => {
  const existing = [rate({ effectiveFrom: '2024-04-01' })];

  it('accepts a well-formed row', () => {
    expect(validateTaxRate({ hsnCode: '7102', description: 'Diamond', gstRatePercent: 1.5, effectiveFrom: '2025-01-01' }, existing)).toBeNull();
  });

  it('requires an HSN, a description, and an effective date', () => {
    expect(validateTaxRate({ description: 'x', gstRatePercent: 3, effectiveFrom: '2025-01-01' })).toMatch(/HSN or SAC/i);
    expect(validateTaxRate({ hsnCode: '7113', gstRatePercent: 3, effectiveFrom: '2025-01-01' })).toMatch(/describe/i);
    expect(validateTaxRate({ hsnCode: '7113', description: 'x', gstRatePercent: 3 })).toMatch(/effective-from/i);
  });

  it('rejects a malformed HSN', () => {
    expect(validateTaxRate({ hsnCode: '71', description: 'x', gstRatePercent: 3, effectiveFrom: '2025-01-01' })).toMatch(/4 to 8 digits/i);
    expect(validateTaxRate({ hsnCode: '71AB', description: 'x', gstRatePercent: 3, effectiveFrom: '2025-01-01' })).toMatch(/4 to 8 digits/i);
  });

  it('rejects an impossible rate', () => {
    expect(validateTaxRate({ hsnCode: '7113', description: 'x', gstRatePercent: -1, effectiveFrom: '2025-01-01' })).toMatch(/valid GST rate/i);
    expect(validateTaxRate({ hsnCode: '7113', description: 'x', gstRatePercent: 40, effectiveFrom: '2025-01-01' })).toMatch(/28%/);
  });

  it('accepts a 0% row, which is a real classification', () => {
    expect(validateTaxRate({ hsnCode: '7118', description: 'Exempt', gstRatePercent: 0, effectiveFrom: '2025-01-01' })).toBeNull();
  });

  it('rejects an end date before the start date', () => {
    expect(validateTaxRate({ hsnCode: '7113', description: 'x', gstRatePercent: 3, effectiveFrom: '2025-06-01', effectiveTo: '2025-01-01' }))
      .toMatch(/cannot precede/i);
  });

  it('rejects a duplicate HSN + effective date', () => {
    expect(validateTaxRate({ hsnCode: '7113', description: 'x', gstRatePercent: 5, effectiveFrom: '2024-04-01' }, existing))
      .toMatch(/already exists/i);
  });
});

describe('supersedeTaxRate — append-only, never an in-place edit', () => {
  const original = rate({ id: 'old', gstRatePercent: 3, effectiveFrom: '2017-07-01' });
  const incoming = rate({ id: 'new', gstRatePercent: 5, effectiveFrom: '2026-04-01' });

  it('retains the old row and closes it the day before the new one starts', () => {
    const result = supersedeTaxRate([original], incoming);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'old')?.effectiveTo).toBe('2026-03-31');
    expect(result.find(r => r.id === 'new')?.effectiveTo).toBeUndefined();
  });

  it('leaves the superseded row resolvable for an invoice inside its own window', () => {
    const result = supersedeTaxRate([original], incoming);
    expect(resolveTaxRate(HSN.JEWELLERY, result, '2020-05-05')?.gstRatePercent).toBe(3);
    expect(resolveTaxRate(HSN.JEWELLERY, result, '2026-05-05')?.gstRatePercent).toBe(5);
  });

  it('does not touch rows for a different HSN', () => {
    const diamond = rate({ id: 'dia', hsnCode: HSN.DIAMOND, effectiveFrom: '2017-07-01' });
    const result = supersedeTaxRate([original, diamond], incoming);
    expect(result.find(r => r.id === 'dia')?.effectiveTo).toBeUndefined();
  });

  it('does not close a row that already has an end date', () => {
    const closed = rate({ id: 'closed', effectiveFrom: '2015-01-01', effectiveTo: '2017-06-30' });
    const result = supersedeTaxRate([closed], incoming);
    expect(result.find(r => r.id === 'closed')?.effectiveTo).toBe('2017-06-30');
  });
});

describe('summariseByHsn (GSTR-1 HSN table)', () => {
  it('groups lines by HSN and sums each component', () => {
    const rows = summariseByHsn(
      [
        { hsnCode: '7113', taxableValue: 100000, cgst: 1500, sgst: 1500, igst: 0, ratePercent: 3 },
        { hsnCode: '7113', taxableValue: 50000, cgst: 750, sgst: 750, igst: 0, ratePercent: 3 },
        { hsnCode: '7108', taxableValue: 20000, cgst: 300, sgst: 300, igst: 0, ratePercent: 3 },
      ],
      [rate({ hsnCode: '7113', description: 'Gold jewellery' })]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ hsnCode: '7108', taxableValue: 20000, description: 'Unclassified' });
    expect(rows[1]).toMatchObject({ hsnCode: '7113', taxableValue: 150000, cgst: 2250, sgst: 2250 });
  });

  it('files an unclassified line under the jewellery HSN rather than dropping it', () => {
    const rows = summariseByHsn([{ taxableValue: 1000, cgst: 15, sgst: 15, igst: 0 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hsnCode).toBe(HSN.JEWELLERY);
  });

  it('summarises an empty register', () => {
    expect(summariseByHsn([])).toEqual([]);
  });
});
