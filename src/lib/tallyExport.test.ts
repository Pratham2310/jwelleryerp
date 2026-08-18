import { describe, it, expect } from 'vitest';
import {
  escapeXml,
  tallyDate,
  tallyAmount,
  toTallyEntry,
  voucherEntries,
  partyLedgerName,
  buildTallyXml,
  vouchersInPeriod,
  summariseExport,
  validateExportRange,
  exportFileName,
  TALLY_VOUCHER_TYPE,
} from './tallyExport';
import { ACCOUNT } from './journalPosting';
import type { JournalVoucher } from './journalPosting';

function voucher(over: Partial<JournalVoucher> = {}): JournalVoucher {
  return {
    id: 'v1', voucherNo: 'INV-2026-1001', date: '2026-07-20', type: 'SALES',
    narration: 'Sale to walk-in customer', sourceType: 'SaleInvoice', sourceId: 'inv-1',
    lines: [
      { accountCode: ACCOUNT.CASH, debit: 10300, credit: 0 },
      { accountCode: ACCOUNT.SALES, debit: 0, credit: 10000 },
      { accountCode: ACCOUNT.OUTPUT_CGST, debit: 0, credit: 150 },
      { accountCode: ACCOUNT.OUTPUT_SGST, debit: 0, credit: 150 },
    ],
    ...over,
  };
}

describe('escapeXml — an unescaped & kills the entire import', () => {
  it('escapes all five reserved characters', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
    expect(escapeXml(`"quoted" 'single'`)).toBe('&quot;quoted&quot; &apos;single&apos;');
  });

  it('handles the seeded supplier name, which really does contain an ampersand', () => {
    expect(escapeXml('Zaveri Bullion & Refinery Co.')).toBe('Zaveri Bullion &amp; Refinery Co.');
  });

  it('escapes & first so entities are not double-escaped', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('tolerates null and undefined rather than printing "undefined" into the file', () => {
    expect(escapeXml(undefined as unknown as string)).toBe('');
    expect(escapeXml(null as unknown as string)).toBe('');
  });
});

describe('tallyDate — YYYYMMDD, no separators', () => {
  it('strips the hyphens', () => {
    expect(tallyDate('2026-07-20')).toBe('20260720');
    expect(tallyDate('2026-01-01')).toBe('20260101');
  });

  it('trims a full timestamp to the date part', () => {
    expect(tallyDate('2026-07-20T13:45:00.000Z')).toBe('20260720');
  });

  it('is empty for missing input rather than throwing mid-export', () => {
    expect(tallyDate('')).toBe('');
    expect(tallyDate(undefined as unknown as string)).toBe('');
  });
});

describe('tallyAmount', () => {
  it('always carries two decimals', () => {
    expect(tallyAmount(10000)).toBe('10000.00');
    expect(tallyAmount(1234.5)).toBe('1234.50');
    expect(tallyAmount(-1234.567)).toBe('-1234.57');
  });

  it('renders zero and junk as 0.00', () => {
    expect(tallyAmount(0)).toBe('0.00');
    expect(tallyAmount(NaN)).toBe('0.00');
  });
});

describe("toTallyEntry — Tally's sign convention is inverted", () => {
  it('makes a DEBIT negative and deemed-positive', () => {
    // Counterintuitive, and reversing it imports cleanly while mirroring every account.
    const e = toTallyEntry(ACCOUNT.CASH, 10300, 0);
    expect(e.amount).toBe(-10300);
    expect(e.isDeemedPositive).toBe(true);
  });

  it('makes a CREDIT positive and not deemed-positive', () => {
    const e = toTallyEntry(ACCOUNT.SALES, 0, 10000);
    expect(e.amount).toBe(10000);
    expect(e.isDeemedPositive).toBe(false);
  });

  it('resolves the human ledger name, not the internal code', () => {
    expect(toTallyEntry(ACCOUNT.SALES, 0, 100).ledgerName).not.toBe(ACCOUNT.SALES);
    expect(toTallyEntry(ACCOUNT.SALES, 0, 100).ledgerName.length).toBeGreaterThan(0);
  });

  it('keeps the debits and credits of a voucher summing to zero in Tally terms', () => {
    // A balanced voucher must net to zero once the sign convention is applied.
    const total = voucherEntries(voucher()).reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(0);
  });
});

describe('partyLedgerName', () => {
  it('uses the first debited account, the convention for a sales voucher', () => {
    expect(partyLedgerName(voucher())).toBe(toTallyEntry(ACCOUNT.CASH, 1, 0).ledgerName);
  });

  it('falls back to the first line when nothing is debited', () => {
    const v = voucher({ lines: [{ accountCode: ACCOUNT.SALES, debit: 0, credit: 100 }] });
    expect(partyLedgerName(v).length).toBeGreaterThan(0);
  });

  it('does not throw on a voucher with no lines', () => {
    expect(() => partyLedgerName(voucher({ lines: [] }))).not.toThrow();
  });
});

describe('buildTallyXml', () => {
  const opts = { companyName: 'Aurum Jewellery House', fromDate: '2026-07-01', toDate: '2026-07-31' };

  it('produces the ENVELOPE / IMPORTDATA structure Tally expects', () => {
    const xml = buildTallyXml([voucher()], opts);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<ENVELOPE>');
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(xml).toContain('<REPORTNAME>Vouchers</REPORTNAME>');
    expect(xml).toContain('</ENVELOPE>');
  });

  it('carries the company and period in the static variables', () => {
    const xml = buildTallyXml([voucher()], opts);
    expect(xml).toContain('<SVCURRENTCOMPANY>Aurum Jewellery House</SVCURRENTCOMPANY>');
    expect(xml).toContain('<SVFROMDATE>20260701</SVFROMDATE>');
    expect(xml).toContain('<SVTODATE>20260731</SVTODATE>');
  });

  it('writes the voucher head in Tally’s own vocabulary', () => {
    const xml = buildTallyXml([voucher()], opts);
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>');
    expect(xml).toContain('<VOUCHERNUMBER>INV-2026-1001</VOUCHERNUMBER>');
    expect(xml).toContain('<DATE>20260720</DATE>');
  });

  it('emits one ledger entry per journal line with the inverted signs', () => {
    const xml = buildTallyXml([voucher()], opts);
    expect((xml.match(/<ALLLEDGERENTRIES\.LIST>/g) || [])).toHaveLength(4);
    expect(xml).toContain('<AMOUNT>-10300.00</AMOUNT>'); // the debit
    expect(xml).toContain('<AMOUNT>10000.00</AMOUNT>');  // the credit
    expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
  });

  it('escapes a narration containing reserved characters', () => {
    const xml = buildTallyXml([voucher({ narration: 'Sale to Ram & Co. <urgent>' })], opts);
    expect(xml).toContain('Ram &amp; Co. &lt;urgent&gt;');
    expect(xml).not.toContain('Ram & Co.');
  });

  it('EXCLUDES an unbalanced voucher rather than shipping a file Tally will reject', () => {
    // A file that fails at the accountant's desk with no explanation is worse than one that is
    // short a voucher and says so.
    const broken = voucher({ id: 'v2', voucherNo: 'BAD-1', lines: [
      { accountCode: ACCOUNT.CASH, debit: 100, credit: 0 },
      { accountCode: ACCOUNT.SALES, debit: 0, credit: 90 },
    ]});
    const xml = buildTallyXml([voucher(), broken], opts);
    expect(xml).toContain('INV-2026-1001');
    expect(xml).not.toContain('BAD-1');
  });

  it('produces a valid empty envelope when there is nothing to export', () => {
    const xml = buildTallyXml([], opts);
    expect(xml).toContain('<REQUESTDATA>');
    expect(xml).not.toContain('<VOUCHER ');
  });

  it('maps every internal voucher type to a Tally one', () => {
    const types = Object.keys(TALLY_VOUCHER_TYPE) as (keyof typeof TALLY_VOUCHER_TYPE)[];
    for (const t of types) {
      const xml = buildTallyXml([voucher({ type: t })], opts);
      expect(xml).toContain(`<VOUCHERTYPENAME>${TALLY_VOUCHER_TYPE[t]}</VOUCHERTYPENAME>`);
    }
  });

  it('is well-formed: every & is a real entity, and tags balance', () => {
    /**
     * The suite runs in Node with no DOMParser and jsdom is not a dependency, so rather than
     * pull one in for a single test this asserts the two properties that actually break a Tally
     * import: a bare ampersand (the bug the seeded supplier name would cause), and unbalanced
     * tags. Both are checked against real reserved characters fed through the narration.
     */
    const xml = buildTallyXml([voucher({ narration: 'Ram & Co. "special" <x> & more' })], opts);

    // Every & must begin a known entity.
    const bareAmp = [...xml.matchAll(/&(?!amp;|lt;|gt;|quot;|apos;)/g)];
    expect(bareAmp).toHaveLength(0);
    expect(xml).toContain('Ram &amp; Co. &quot;special&quot; &lt;x&gt; &amp; more');

    // Every opening tag has a matching close, ignoring the declaration and self-contained attrs.
    const opens = [...xml.matchAll(/<([A-Z][A-Z0-9.]*)(?:\s[^>]*)?>/g)].map(m => m[1]);
    const closes = [...xml.matchAll(/<\/([A-Z][A-Z0-9.]*)>/g)].map(m => m[1]);
    expect(opens.sort()).toEqual(closes.sort());
  });
});

describe('vouchersInPeriod', () => {
  const list = [
    voucher({ id: 'a', voucherNo: 'B', date: '2026-07-15' }),
    voucher({ id: 'b', voucherNo: 'A', date: '2026-07-15' }),
    voucher({ id: 'c', date: '2026-06-30' }),
    voucher({ id: 'd', date: '2026-08-01' }),
  ];

  it('includes both boundary dates', () => {
    expect(vouchersInPeriod(list, '2026-06-30', '2026-08-01')).toHaveLength(4);
  });

  it('excludes anything outside the range', () => {
    expect(vouchersInPeriod(list, '2026-07-01', '2026-07-31').map(v => v.id).sort())
      .toEqual(['a', 'b']);
  });

  it('sorts by date then voucher number, so the file is deterministic', () => {
    expect(vouchersInPeriod(list, '2026-07-01', '2026-07-31').map(v => v.voucherNo))
      .toEqual(['A', 'B']);
  });

  it('is empty for a period with nothing in it', () => {
    expect(vouchersInPeriod(list, '2027-01-01', '2027-01-31')).toEqual([]);
  });
});

describe('summariseExport', () => {
  it('summarises an empty selection', () => {
    expect(summariseExport([])).toMatchObject({ totalVouchers: 0, exportable: 0, excludedUnbalanced: 0 });
  });

  it('reports what will and will not be exported', () => {
    const broken = voucher({ id: 'v2', lines: [
      { accountCode: ACCOUNT.CASH, debit: 100, credit: 0 },
      { accountCode: ACCOUNT.SALES, debit: 0, credit: 90 },
    ]});
    const s = summariseExport([voucher(), broken]);
    expect(s.totalVouchers).toBe(2);
    expect(s.exportable).toBe(1);
    expect(s.excludedUnbalanced).toBe(1);
  });

  it('totals debits and credits of the exportable set, which must agree', () => {
    const s = summariseExport([voucher(), voucher({ id: 'v3' })]);
    expect(s.totalDebit).toBe(20600);
    expect(s.totalCredit).toBe(20600);
  });

  it('counts by Tally voucher type', () => {
    const s = summariseExport([voucher(), voucher({ id: 'v4', type: 'SCHEME_COLLECTION', lines: [
      { accountCode: ACCOUNT.CASH, debit: 5000, credit: 0 },
      { accountCode: ACCOUNT.SCHEME_LIABILITY, debit: 0, credit: 5000 },
    ]})]);
    expect(s.byType).toEqual([{ type: 'Receipt', count: 1 }, { type: 'Sales', count: 1 }]);
  });
});

describe('validateExportRange & file name', () => {
  it('requires both dates in order', () => {
    expect(validateExportRange('', '2026-07-31')).toMatch(/start date/i);
    expect(validateExportRange('2026-07-01', '')).toMatch(/end date/i);
    expect(validateExportRange('2026-07-31', '2026-07-01')).toMatch(/cannot be before/i);
    expect(validateExportRange('2026-07-01', '2026-07-31')).toBeNull();
  });

  it('allows a single-day export', () => {
    expect(validateExportRange('2026-07-01', '2026-07-01')).toBeNull();
  });

  it('names the file with its period so exports do not overwrite each other', () => {
    expect(exportFileName('2026-07-01', '2026-07-31')).toBe('Aurum_Tally_20260701_20260731.xml');
  });
});
