import { describe, it, expect } from 'vitest';
import { isPanRequired, isValidPanFormat, validatePanDeclaration, PAN_THRESHOLD } from './statutoryChecks';

describe('statutoryChecks.isPanRequired', () => {
  it('is not required below the threshold', () => {
    expect(isPanRequired(PAN_THRESHOLD - 1)).toBe(false);
    expect(isPanRequired(0)).toBe(false);
  });

  it('is required at and above the threshold', () => {
    expect(isPanRequired(PAN_THRESHOLD)).toBe(true);
    expect(isPanRequired(PAN_THRESHOLD + 1)).toBe(true);
  });
});

describe('statutoryChecks.isValidPanFormat', () => {
  it('accepts a correctly formatted PAN', () => {
    expect(isValidPanFormat('ABCDE1234F')).toBe(true);
    expect(isValidPanFormat('abcde1234f')).toBe(true); // normalized to uppercase
    expect(isValidPanFormat('  ABCDE1234F  ')).toBe(true);
  });

  it('rejects malformed PANs', () => {
    expect(isValidPanFormat('')).toBe(false);
    expect(isValidPanFormat('ABCD1234F')).toBe(false); // only 4 leading letters
    expect(isValidPanFormat('ABCDE12345')).toBe(false); // trailing char must be a letter
    expect(isValidPanFormat('ABCDE123F')).toBe(false); // only 3 digits
    expect(isValidPanFormat('12345ABCDF')).toBe(false); // digits/letters transposed
  });
});

describe('statutoryChecks.validatePanDeclaration', () => {
  it('allows a below-threshold sale with no declaration at all', () => {
    expect(validatePanDeclaration(50000, null)).toBeNull();
  });

  it('blocks an at-threshold sale with no declaration', () => {
    expect(validatePanDeclaration(PAN_THRESHOLD, null)).toMatch(/mandatory/i);
  });

  it('blocks an above-threshold sale whose PAN is malformed', () => {
    expect(validatePanDeclaration(500000, { type: 'PAN', panNumber: 'BADPAN' })).toMatch(/valid PAN/i);
  });

  it('allows an above-threshold sale with a valid PAN', () => {
    expect(validatePanDeclaration(500000, { type: 'PAN', panNumber: 'ABCDE1234F' })).toBeNull();
  });

  it('allows an above-threshold sale with a Form 60 declaration instead of a PAN', () => {
    expect(validatePanDeclaration(500000, { type: 'FORM_60' })).toBeNull();
  });
});
