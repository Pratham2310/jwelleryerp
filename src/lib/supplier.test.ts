import { describe, it, expect } from 'vitest';
import {
  GSTIN_PATTERN,
  normaliseGstin,
  isValidGstinFormat,
  stateCodeFromGstin,
  panFromGstin,
  validatePartyIdentity,
  deriveIdentityFromGstin,
  nextSupplierCode,
  validateSupplier,
  supplierBalanceLabel,
  summariseSuppliers,
  selectableSuppliers,
  validateCustomerKyc,
  maskAadhaar,
  SUPPLIER_TYPE_LABEL,
} from './supplier';
import type { Supplier } from '../types';

// A real-shaped Maharashtra (27) GSTIN whose embedded PAN is AACCS9948H.
const MH_GSTIN = '27AACCS9948H1Z1';
const KA_GSTIN = '29AACCS9948H1Z5';

function supplier(over: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1', supplierCode: 'SUP-0001', name: 'Zaveri Bullion Co.',
    supplierType: 'BULLION_DEALER', phone: '9876543210',
    gstin: MH_GSTIN, pan: 'AACCS9948H', stateCode: '27',
    openingBalance: 0, creditTermsDays: 30, isActive: true, ...over,
  };
}

describe('GSTIN structure', () => {
  it('accepts a well-formed GSTIN and uppercases it', () => {
    expect(isValidGstinFormat(MH_GSTIN)).toBe(true);
    expect(normaliseGstin(' 27aaccs9948h1z1 ')).toBe(MH_GSTIN);
    expect(isValidGstinFormat('27aaccs9948h1z1')).toBe(true);
  });

  it('rejects the wrong length or shape', () => {
    expect(isValidGstinFormat('27AACCS9948H1Z')).toBe(false);   // 14
    expect(isValidGstinFormat('27AACCS9948H1Z11')).toBe(false); // 16
    expect(isValidGstinFormat('27AACCS9948H1X1')).toBe(false);  // 14th char must be Z
    expect(isValidGstinFormat('')).toBe(false);
  });

  it('exposes the state code and PAN it carries', () => {
    // These are not conventions we invented — they are positions defined by the GSTIN format.
    expect(stateCodeFromGstin(MH_GSTIN)).toBe('27');
    expect(panFromGstin(MH_GSTIN)).toBe('AACCS9948H');
    expect(stateCodeFromGstin(KA_GSTIN)).toBe('29');
  });

  it('returns null rather than a wrong answer for a malformed GSTIN', () => {
    expect(stateCodeFromGstin('nonsense')).toBeNull();
    expect(panFromGstin('nonsense')).toBeNull();
    expect(GSTIN_PATTERN.test('nonsense')).toBe(false);
  });
});

describe('validatePartyIdentity — the three fields must agree', () => {
  it('accepts a consistent set', () => {
    expect(validatePartyIdentity({ gstin: MH_GSTIN, pan: 'AACCS9948H', stateCode: '27' })).toBeNull();
  });

  it('catches a state code that contradicts the GSTIN', () => {
    // This is the one that silently breaks M21: the wrong state picks IGST over CGST+SGST on
    // every document for the party, and nobody notices until a return is filed.
    const err = validatePartyIdentity({ gstin: MH_GSTIN, stateCode: '29' });
    expect(err).toMatch(/registered in state 27/);
    expect(err).toMatch(/tax split depends on it/);
  });

  it('catches a PAN that contradicts the GSTIN', () => {
    const err = validatePartyIdentity({ gstin: MH_GSTIN, pan: 'AAAAA1111A' });
    expect(err).toMatch(/contains PAN AACCS9948H/);
  });

  it('rejects a malformed GSTIN or PAN before comparing them', () => {
    expect(validatePartyIdentity({ gstin: 'BAD' })).toMatch(/15 characters/);
    expect(validatePartyIdentity({ pan: 'BAD' })).toMatch(/10 characters/);
  });

  it('does not require the fields — only that present ones agree', () => {
    expect(validatePartyIdentity({})).toBeNull();
    expect(validatePartyIdentity({ stateCode: '27' })).toBeNull();
    expect(validatePartyIdentity({ pan: 'AACCS9948H' })).toBeNull();
  });

  it('is case- and space-insensitive about the GSTIN', () => {
    expect(validatePartyIdentity({ gstin: ' 27aaccs9948h1z1 ', stateCode: '27' })).toBeNull();
  });
});

describe('deriveIdentityFromGstin', () => {
  it('fills the state and PAN that the GSTIN already contains', () => {
    const filled = deriveIdentityFromGstin({ gstin: MH_GSTIN });
    expect(filled.stateCode).toBe('27');
    expect(filled.pan).toBe('AACCS9948H');
  });

  it('never overwrites what the operator typed', () => {
    const filled = deriveIdentityFromGstin({ gstin: MH_GSTIN, stateCode: '29', pan: 'AAAAA1111A' });
    expect(filled.stateCode).toBe('29');
    expect(filled.pan).toBe('AAAAA1111A');
  });

  it('leaves a malformed GSTIN untouched rather than deriving nonsense', () => {
    const input = { gstin: 'BAD' };
    expect(deriveIdentityFromGstin(input)).toEqual(input);
  });
});

describe('validateSupplier', () => {
  it('accepts a well-formed supplier', () => {
    expect(validateSupplier(supplier())).toBeNull();
  });

  it('requires a name and a reachable mobile', () => {
    expect(validateSupplier(supplier({ name: '' }))).toMatch(/supplier name/i);
    expect(validateSupplier(supplier({ phone: '' }))).toMatch(/mobile number is required/i);
    expect(validateSupplier(supplier({ phone: '12345' }))).toMatch(/valid 10-digit/i);
  });

  it('requires a bullion dealer to be GST-registered', () => {
    // PRD §6.1: ITC on bullion is claimed against a registered dealer's tax invoice. Without a
    // GSTIN the purchase could be booked but its input credit could never be claimed.
    const err = validateSupplier(supplier({ gstin: '', pan: undefined, stateCode: undefined }));
    expect(err).toMatch(/bullion dealer must have a GSTIN/i);
  });

  it('allows an unregistered wholesaler or service provider', () => {
    expect(validateSupplier(supplier({
      supplierType: 'SERVICE', gstin: '', pan: undefined, stateCode: undefined,
    }))).toBeNull();
  });

  it('propagates an identity contradiction', () => {
    expect(validateSupplier(supplier({ stateCode: '29' }))).toMatch(/registered in state 27/);
  });

  it('rejects implausible credit terms', () => {
    expect(validateSupplier(supplier({ creditTermsDays: -1 }))).toMatch(/between 0 and 365/);
    expect(validateSupplier(supplier({ creditTermsDays: 400 }))).toMatch(/between 0 and 365/);
    expect(validateSupplier(supplier({ creditTermsDays: 0 }))).toBeNull(); // cash purchase
  });

  it('refuses a duplicate GSTIN — that is the same legal entity twice', () => {
    const err = validateSupplier(supplier({ id: 'new' }), [supplier()]);
    expect(err).toMatch(/already recorded against Zaveri Bullion Co\./);
  });

  it('lets a supplier keep its own GSTIN when edited', () => {
    expect(validateSupplier(supplier(), [supplier()])).toBeNull();
  });
});

describe('supplier codes', () => {
  it('starts at SUP-0001 and continues from the highest, not a count', () => {
    expect(nextSupplierCode([])).toBe('SUP-0001');
    expect(nextSupplierCode([supplier({ supplierCode: 'SUP-0009' })])).toBe('SUP-0010');
  });

  it('ignores codes that do not fit the series', () => {
    expect(nextSupplierCode([supplier({ supplierCode: 'LEGACY-7' })])).toBe('SUP-0001');
  });
});

describe('balance sign convention', () => {
  it('reads positive as owed to the supplier and negative as an advance', () => {
    expect(supplierBalanceLabel(5000)).toMatch(/Payable to supplier/);
    expect(supplierBalanceLabel(-5000)).toMatch(/Advance with supplier/);
    expect(supplierBalanceLabel(0)).toBe('Settled');
  });
});

describe('summariseSuppliers', () => {
  it('summarises an empty book', () => {
    expect(summariseSuppliers([])).toEqual({
      total: 0, active: 0, registered: 0, unregistered: 0, totalPayable: 0, totalAdvances: 0,
    });
  });

  it('separates registered from unregistered, which drives reverse-charge exposure', () => {
    const s = summariseSuppliers([
      supplier({ id: 'a', openingBalance: 50000 }),
      supplier({ id: 'b', supplierType: 'SERVICE', gstin: '', pan: undefined, stateCode: undefined, openingBalance: -2000 }),
      supplier({ id: 'c', isActive: false, openingBalance: 99999 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.registered).toBe(1);
    expect(s.unregistered).toBe(1);
    expect(s.totalPayable).toBe(50000);
    expect(s.totalAdvances).toBe(2000);
  });

  it('excludes inactive suppliers from the money figures', () => {
    expect(summariseSuppliers([supplier({ isActive: false, openingBalance: 99999 })].map(x => x)).totalPayable).toBe(0);
  });

  it('offers only active suppliers on a purchase document', () => {
    const list = [supplier({ id: 'a' }), supplier({ id: 'b', isActive: false })];
    expect(selectableSuppliers(list).map(s => s.id)).toEqual(['a']);
  });

  it('labels every supplier type', () => {
    expect(Object.keys(SUPPLIER_TYPE_LABEL)).toHaveLength(3);
    expect(SUPPLIER_TYPE_LABEL.BULLION_DEALER).toBe('Bullion Dealer');
  });
});

describe('customer KYC (PRD §4.4)', () => {
  it('accepts a consistent customer', () => {
    expect(validateCustomerKyc({ gstin: MH_GSTIN, pan: 'AACCS9948H', stateCode: '27' })).toBeNull();
  });

  it('applies the same identity cross-checks as a supplier', () => {
    expect(validateCustomerKyc({ gstin: MH_GSTIN, stateCode: '29' })).toMatch(/registered in state 27/);
  });

  it('validates Aadhaar length, ignoring spacing', () => {
    expect(validateCustomerKyc({ aadhaar: '1234 5678 9012' })).toBeNull();
    expect(validateCustomerKyc({ aadhaar: '12345' })).toMatch(/12 digits/);
  });

  it('rejects a negative credit limit', () => {
    expect(validateCustomerKyc({ creditLimit: -1 })).toMatch(/cannot be negative/i);
  });

  it('masks an Aadhaar to its last four digits', () => {
    // UIDAI guidance: a full Aadhaar should never be displayed back.
    expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
  });

  it('returns nothing to display for a missing or malformed Aadhaar', () => {
    expect(maskAadhaar('')).toBe('');
    expect(maskAadhaar('12345')).toBe('');
    expect(maskAadhaar(undefined)).toBe('');
  });
});
