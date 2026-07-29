import { describe, it, expect } from 'vitest';
import {
  periodOf,
  periodLabel,
  availablePeriods,
  isReportable,
  filterByPeriod,
  buildB2B,
  buildB2CS,
  buildCreditNotes,
  buildHsnSummary,
  buildGstr3b,
  reconcile,
  csvCell,
  toCsv,
  gstr1Csv,
  gstr3bCsv,
} from './gstReturns';
import type { SaleInvoice, InvoiceItem } from '../types';

function item(over: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    name: 'Ring', metalType: 'Gold (22K)', netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, goldPrice: 66500,
    wastageValue: 1995, makingCharge: 4000, stoneCharge: 0, subtotal: 100000,
    hsnCode: '7113', gstRatePercent: 3, ...over,
  };
}

function inv(over: Partial<SaleInvoice> = {}): SaleInvoice {
  return {
    id: 'i1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'MUM/2026-27/0001',
    date: '2026-07-15', customerName: 'Walk-in', customerPhone: 'N/A',
    items: [item()], oldGoldWeight: 0, oldGoldValue: 0,
    subtotal: 100000, tax: 3000, discount: 0, grandTotal: 103000, netAmountDue: 103000,
    paymentMethod: 'Cash', cgst: 1500, sgst: 1500, igst: 0,
    supplyType: 'INTRA_STATE', placeOfSupplyStateCode: '27', ...over,
  };
}

const gstinOf = (i: SaleInvoice) => (i.customerId === 'b2b' ? '29AABCU9603R1ZM' : undefined);

describe('period helpers', () => {
  it('derives and labels a period', () => {
    expect(periodOf('2026-07-15')).toBe('2026-07');
    expect(periodLabel('2026-07')).toBe('July 2026');
  });

  it('lists periods that have fiscal documents, newest first', () => {
    const list = [
      inv({ id: 'a', date: '2026-06-10' }),
      inv({ id: 'b', date: '2026-07-15' }),
      inv({ id: 'c', date: '2026-07-20' }),
      inv({ id: 'd', date: '2026-08-01', invoiceType: 'ESTIMATE' }), // excluded
    ];
    expect(availablePeriods(list)).toEqual(['2026-07', '2026-06']);
  });
});

describe('isReportable — an estimate is never a supply', () => {
  it('includes tax invoices and credit notes only', () => {
    expect(isReportable(inv({ invoiceType: 'TAX_INVOICE' }))).toBe(true);
    expect(isReportable(inv({ invoiceType: 'CREDIT_NOTE' }))).toBe(true);
    // Including a quotation would create output tax the shop does not owe.
    expect(isReportable(inv({ invoiceType: 'ESTIMATE' }))).toBe(false);
  });

  it('drops estimates when filtering a period', () => {
    const list = [inv({ id: 'a' }), inv({ id: 'b', invoiceType: 'ESTIMATE' })];
    expect(filterByPeriod(list, '2026-07').map(i => i.id)).toEqual(['a']);
  });
});

describe('GSTR-1 4A — B2B', () => {
  it('reports a registered buyer invoice by invoice', () => {
    const rows = buildB2B([inv({ customerId: 'b2b', customerName: 'Ananya Traders' })], gstinOf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gstin: '29AABCU9603R1ZM',
      customerName: 'Ananya Traders',
      invoiceValue: 103000,
      taxableValue: 100000,
      cgst: 1500,
      sgst: 1500,
    });
  });

  it('excludes unregistered buyers, who belong in B2CS', () => {
    expect(buildB2B([inv()], gstinOf)).toHaveLength(0);
  });

  it('excludes credit notes, which have their own table', () => {
    expect(buildB2B([inv({ customerId: 'b2b', invoiceType: 'CREDIT_NOTE' })], gstinOf)).toHaveLength(0);
  });

  it('reports the taxable value net of discount, not the gross subtotal', () => {
    const rows = buildB2B([inv({ customerId: 'b2b', discount: 5000 })], gstinOf);
    expect(rows[0].taxableValue).toBe(95000);
  });
});

describe('GSTR-1 7 — B2CS consolidated', () => {
  it('groups by place of supply and rate rather than listing invoices', () => {
    const rows = buildB2CS([
      inv({ id: 'a', placeOfSupplyStateCode: '27' }),
      inv({ id: 'b', placeOfSupplyStateCode: '27' }),
      inv({ id: 'c', placeOfSupplyStateCode: '29', cgst: 0, sgst: 0, igst: 3000, supplyType: 'INTER_STATE' }),
    ], gstinOf, '27');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ placeOfSupply: '27', taxableValue: 200000, cgst: 3000, sgst: 3000, invoiceCount: 2 });
    expect(rows[1]).toMatchObject({ placeOfSupply: '29', taxableValue: 100000, igst: 3000, invoiceCount: 1 });
  });

  it('separates different rates at the same place of supply', () => {
    const rows = buildB2CS([
      inv({ id: 'a', items: [item({ gstRatePercent: 3 })] }),
      inv({ id: 'b', items: [item({ gstRatePercent: 1.5 })] }),
    ], gstinOf, '27');
    expect(rows.map(r => r.ratePercent)).toEqual([1.5, 3]);
  });

  it('falls back to the home state when an invoice carries no place of supply', () => {
    const rows = buildB2CS([inv({ placeOfSupplyStateCode: undefined })], gstinOf, '27');
    expect(rows[0].placeOfSupply).toBe('27');
  });

  it('excludes registered buyers', () => {
    expect(buildB2CS([inv({ customerId: 'b2b' })], gstinOf, '27')).toHaveLength(0);
  });
});

describe('GSTR-1 9B — credit notes', () => {
  const note = inv({
    id: 'cn', invoiceType: 'CREDIT_NOTE', invoiceNumber: 'CRN-2026-901',
    creditNoteAgainstInvoice: 'MUM/2026-27/0001', creditNoteAgainstInvoiceDate: '2026-07-10',
    subtotal: -40000, discount: 0, tax: -1200, grandTotal: -41200, netAmountDue: -41200,
    cgst: -600, sgst: -600, igst: 0,
  });

  it('reports positive magnitudes even though records are stored negative', () => {
    // The return asks what was credited; the portal applies the sign. Filing these
    // negative would double-subtract them.
    const rows = buildCreditNotes([note], gstinOf);
    expect(rows[0]).toMatchObject({
      noteNumber: 'CRN-2026-901',
      againstInvoice: 'MUM/2026-27/0001',
      againstInvoiceDate: '2026-07-10',
      noteValue: 41200,
      taxableValue: 40000,
      cgst: 600,
      sgst: 600,
    });
  });

  it('ignores tax invoices', () => {
    expect(buildCreditNotes([inv()], gstinOf)).toHaveLength(0);
  });
});

describe('GSTR-1 12 — HSN summary', () => {
  it('groups lines by HSN across invoices', () => {
    const rows = buildHsnSummary([
      inv({ id: 'a', items: [item({ hsnCode: '7113', subtotal: 100000 })] }),
      inv({ id: 'b', items: [item({ hsnCode: '7108', subtotal: 100000 })] }),
    ]);
    expect(rows.map(r => r.hsnCode)).toEqual(['7108', '7113']);
  });

  it('apportions a bill-level discount across lines so the total still reconciles', () => {
    const rows = buildHsnSummary([
      inv({
        items: [item({ hsnCode: '7113', subtotal: 60000 }), item({ hsnCode: '7108', subtotal: 40000 })],
        subtotal: 100000, discount: 10000,
      }),
    ]);
    const total = rows.reduce((s, r) => s + r.taxableValue, 0);
    expect(total).toBe(90000); // 100000 - 10000, split 54000 / 36000
    expect(rows.find(r => r.hsnCode === '7113')!.taxableValue).toBe(54000);
    expect(rows.find(r => r.hsnCode === '7108')!.taxableValue).toBe(36000);
  });
});

describe('GSTR-3B 3.1(a)', () => {
  it('nets credit notes against outward supplies', () => {
    const s = buildGstr3b([
      inv({ id: 'a' }),
      inv({ id: 'cn', invoiceType: 'CREDIT_NOTE', subtotal: -40000, tax: -1200, grandTotal: -41200, cgst: -600, sgst: -600, igst: 0 }),
    ]);
    expect(s.taxableValue).toBe(60000); // 100000 - 40000
    expect(s.cgst).toBe(900);
    expect(s.sgst).toBe(900);
    expect(s.totalTax).toBe(1800);
    expect(s.invoiceCount).toBe(1);
    expect(s.creditNoteCount).toBe(1);
  });

  it('summarises an empty period without dividing by anything', () => {
    expect(buildGstr3b([])).toMatchObject({ taxableValue: 0, totalTax: 0, invoiceCount: 0, creditNoteCount: 0 });
  });

  it('treats a pre-Milestone-21 invoice with no split as intra-state', () => {
    // Those documents predate CGST/SGST fields, and every sale then was to the home state.
    const legacy = inv({ cgst: undefined, sgst: undefined, igst: undefined, tax: 3000 });
    const s = buildGstr3b([legacy]);
    expect(s.cgst + s.sgst).toBe(3000);
    expect(s.igst).toBe(0);
  });

  it('splits an odd legacy tax without losing or inventing a rupee', () => {
    const legacy = inv({ cgst: undefined, sgst: undefined, igst: undefined, tax: 8683 });
    const s = buildGstr3b([legacy]);
    expect(s.cgst + s.sgst).toBe(8683);
  });
});

describe('reconciliation — the milestone acceptance criterion', () => {
  it('balances the return against the underlying register', () => {
    const list = [
      inv({ id: 'a' }),
      inv({ id: 'b', placeOfSupplyStateCode: '29', supplyType: 'INTER_STATE', cgst: 0, sgst: 0, igst: 3000 }),
      inv({ id: 'cn', invoiceType: 'CREDIT_NOTE', subtotal: -40000, tax: -1200, grandTotal: -41200, cgst: -600, sgst: -600, igst: 0 }),
    ];
    const check = reconcile(list, buildGstr3b(list));
    expect(check.taxDifference).toBe(0);
    expect(check.taxableDifference).toBe(0);
    expect(check.balanced).toBe(true);
    expect(check.returnTax).toBe(check.registerTax);
  });

  it('detects a document whose components disagree with its own tax field', () => {
    // A corrupted record must surface here rather than silently misfiling the return.
    const broken = inv({ tax: 3000, cgst: 1000, sgst: 1000, igst: 0 });
    const check = reconcile([broken], buildGstr3b([broken]));
    expect(check.balanced).toBe(false);
    expect(check.taxDifference).toBe(1000);
  });
});

describe('CSV escaping', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    // Getting this wrong shifts every following column.
    expect(csvCell('Sharma, Sharda')).toBe('"Sharma, Sharda"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves plain values alone and renders undefined as empty', () => {
    expect(csvCell('Ring')).toBe('Ring');
    expect(csvCell(1500)).toBe('1500');
    expect(csvCell(undefined)).toBe('');
  });

  it('joins rows with CRLF, as spreadsheet tools expect', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2');
  });
});

describe('CSV export content', () => {
  const list = [inv({ customerId: 'b2b', customerName: 'Ananya Traders' }), inv({ id: 'x' })];

  it('emits every GSTR-1 section with its figures', () => {
    const csv = gstr1Csv(
      {
        b2b: buildB2B(list, gstinOf),
        b2cs: buildB2CS(list, gstinOf, '27'),
        creditNotes: buildCreditNotes(list, gstinOf),
        hsn: buildHsnSummary(list),
      },
      '2026-07',
      '27AACCS9948H1Z1'
    );
    expect(csv).toContain('4A - B2B Invoices');
    expect(csv).toContain('7 - B2C (Small) Consolidated');
    expect(csv).toContain('9B - Credit Notes');
    expect(csv).toContain('12 - HSN Summary');
    expect(csv).toContain('29AABCU9603R1ZM');
    expect(csv).toContain('July 2026');
  });

  it('emits the 3B summary with the totals it reports', () => {
    const csv = gstr3bCsv(buildGstr3b(list), '2026-07', '27AACCS9948H1Z1');
    expect(csv).toContain('GSTR-3B');
    expect(csv).toContain('200000'); // 2 x 100000 taxable
    expect(csv).toContain('Total Tax Payable,6000');
  });
});
