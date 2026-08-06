import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CREDIT_DAYS,
  bucketOf,
  creditPortionPaisa,
  receivedAgainst,
  openInvoices,
  customerExposure,
  checkCreditLimit,
  suggestFifoAllocation,
  allocatedTotal,
  validateReceipt,
  buildReceipt,
  ageingSummary,
  customerBalances,
  summariseReceivables,
  nextReceiptNumber,
  type CustomerReceipt,
} from './receivables';
import type { SaleInvoice, Customer } from '../types';

const TODAY = '2026-08-06';

const invoice = (over: Partial<SaleInvoice> = {}): SaleInvoice => ({
  id: 'i1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'MUM-2026-1', date: '2026-08-01',
  customerId: 'c1', customerName: 'Shrutika D.', customerPhone: 'x', items: [],
  oldGoldWeight: 0, oldGoldValue: 0, subtotal: 100000, tax: 3000, discount: 0,
  grandTotal: 103000, netAmountDue: 103000, paymentMethod: 'Credit',
  ...over,
} as SaleInvoice);

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'c1', name: 'Shrutika D.', phone: '9876543210', email: '', tier: 'Gold',
  loyaltyPoints: 0, lifetimeSpend: 0, savingsSchemeActive: false, creditLimit: 200000,
  ...over,
} as Customer);

const receipt = (over: Partial<CustomerReceipt> = {}): CustomerReceipt => ({
  id: 'r1', receiptNumber: 'RCPT-2026-1', date: '2026-08-05', customerId: 'c1',
  customerName: 'Shrutika D.', amountPaisa: 5000000, mode: 'Cash',
  allocations: [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 5000000 }],
  receivedBy: 'Sharda M.',
  ...over,
});

describe('what counts as credit', () => {
  it('takes the whole net due when the tender is Credit', () => {
    expect(creditPortionPaisa(invoice())).toBe(10300000);
  });

  it('is zero for a cash sale', () => {
    expect(creditPortionPaisa(invoice({ paymentMethod: 'Cash' }))).toBe(0);
  });

  it('takes only the credit leg of a split tender', () => {
    const split = invoice({
      paymentMethod: 'Mixed',
      paymentSplit: [{ mode: 'Cash', amount: 50000 }, { mode: 'Credit', amount: 53000 }],
    } as Partial<SaleInvoice>);
    expect(creditPortionPaisa(split)).toBe(5300000);
  });

  it('IGNORES a credit note — a return is not a receivable', () => {
    expect(creditPortionPaisa(invoice({ invoiceType: 'CREDIT_NOTE' }))).toBe(0);
  });

  it('ignores an estimate', () => {
    expect(creditPortionPaisa(invoice({ invoiceType: 'ESTIMATE' }))).toBe(0);
  });
});

describe('ageing is measured from the invoice date', () => {
  it('buckets by age', () => {
    expect(bucketOf(0)).toBe('0-30');
    expect(bucketOf(30)).toBe('0-30');
    expect(bucketOf(31)).toBe('31-60');
    expect(bucketOf(61)).toBe('61-90');
    expect(bucketOf(91)).toBe('90+');
  });

  it('ages an open bill from when it was raised', () => {
    // Ageing from a due date would show a 45-day-old bill as "15 days" — flattering and
    // useless for collection.
    const [row] = openInvoices([invoice({ date: '2026-07-01' })], [], TODAY);
    expect(row.ageDays).toBe(36);
    expect(row.bucket).toBe('31-60');
  });
});

describe('outstanding', () => {
  it('nets receipts allocated against the bill', () => {
    const [row] = openInvoices([invoice()], [receipt({ allocations: [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 3000000 }] })], TODAY);
    expect(row.receivedPaisa).toBe(3000000);
    expect(row.outstandingPaisa).toBe(7300000);
  });

  it('drops a fully settled bill from the open list', () => {
    const full = receipt({ allocations: [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 10300000 }] });
    expect(openInvoices([invoice()], [full], TODAY)).toHaveLength(0);
  });

  it('ignores a receipt allocated to a different bill', () => {
    const other = receipt({ allocations: [{ invoiceNumber: 'MUM-2026-9', amountPaisa: 5000000 }] });
    expect(receivedAgainst('MUM-2026-1', [other])).toBe(0);
  });

  it('sorts oldest first, which is the order a collector works in', () => {
    const rows = openInvoices([
      invoice({ id: 'b', invoiceNumber: 'MUM-2026-2', date: '2026-08-03' }),
      invoice({ id: 'a', invoiceNumber: 'MUM-2026-1', date: '2026-07-01' }),
    ], [], TODAY);
    expect(rows.map(r => r.invoiceNumber)).toEqual(['MUM-2026-1', 'MUM-2026-2']);
  });

  it('totals a customer\'s exposure', () => {
    expect(customerExposure('c1', [invoice()], [], TODAY)).toBe(10300000);
  });
});

describe('checkCreditLimit', () => {
  it('allows a sale within the limit', () => {
    const check = checkCreditLimit(customer(), 5000000, [], [], TODAY);
    expect(check.allowed).toBe(true);
    expect(check.message).toBeNull();
  });

  it('REFUSES credit to a walk-in — nobody to collect from', () => {
    const check = checkCreditLimit(null, 5000000, [], [], TODAY);
    expect(check.allowed).toBe(false);
    expect(check.message).toMatch(/needs a named customer/i);
  });

  it('treats NO limit as none, not unlimited', () => {
    // Selling on credit to someone nobody has assessed is the decision this surfaces.
    const check = checkCreditLimit(customer({ creditLimit: 0 }), 100, [], [], TODAY);
    expect(check.allowed).toBe(false);
    expect(check.message).toMatch(/no credit limit set/i);
  });

  it('counts existing exposure, not just the new sale', () => {
    const check = checkCreditLimit(customer(), 12000000, [invoice()], [], TODAY);
    expect(check.exposurePaisa).toBe(10300000);
    expect(check.allowed).toBe(false);
    expect(check.message).toMatch(/against a limit of/i);
  });

  it('lets a receipt free up headroom again', () => {
    const paid = receipt({ allocations: [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 10300000 }] });
    const check = checkCreditLimit(customer(), 1500000, [invoice()], [paid], TODAY);
    expect(check.exposurePaisa).toBe(0);
    expect(check.allowed).toBe(true);
  });

  it('allows exactly reaching the limit', () => {
    expect(checkCreditLimit(customer({ creditLimit: 1000 }), 100000, [], [], TODAY).allowed).toBe(true);
  });
});

describe('allocation is explicit, never implied', () => {
  const open = openInvoices([
    invoice({ id: 'a', invoiceNumber: 'MUM-2026-1', date: '2026-07-01' }),
    invoice({ id: 'b', invoiceNumber: 'MUM-2026-2', date: '2026-08-01' }),
  ], [], TODAY);

  it('suggests oldest first', () => {
    const alloc = suggestFifoAllocation(open, 12000000);
    expect(alloc[0]).toMatchObject({ invoiceNumber: 'MUM-2026-1', amountPaisa: 10300000 });
    expect(alloc[1]).toMatchObject({ invoiceNumber: 'MUM-2026-2', amountPaisa: 1700000 });
  });

  it('stops when the money runs out', () => {
    expect(suggestFifoAllocation(open, 5000000)).toEqual([
      { invoiceNumber: 'MUM-2026-1', amountPaisa: 5000000 },
    ]);
  });

  it('never suggests more than a bill is owed', () => {
    const alloc = suggestFifoAllocation(open, 99000000);
    expect(allocatedTotal(alloc)).toBe(20600000);
  });

  it('REFUSES an unallocated receipt', () => {
    // That is exactly the "which bill did this settle?" problem.
    expect(validateReceipt(5000000, [], open, 'S')).toMatch(/allocate the receipt against at least one/i);
  });

  it('refuses allocating more than the receipt', () => {
    const over = [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 6000000 }];
    expect(validateReceipt(5000000, over, open, 'S')).toMatch(/against a receipt of/i);
  });

  it('refuses allocating more than a bill has outstanding', () => {
    const over = [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 11000000 }];
    expect(validateReceipt(11000000, over, open, 'S')).toMatch(/only has ₹1,03,000 outstanding/i);
  });

  it('refuses an allocation to a bill that is not open', () => {
    const ghost = [{ invoiceNumber: 'MUM-9999-9', amountPaisa: 100 }];
    expect(validateReceipt(100, ghost, open, 'S')).toMatch(/not an open bill/i);
  });

  it('refuses a part-allocated receipt rather than swallowing the remainder', () => {
    const partial = [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 1000000 }];
    expect(validateReceipt(5000000, partial, open, 'S')).toMatch(/would sit on account/i);
  });

  it('accepts a fully allocated receipt', () => {
    expect(validateReceipt(12000000, suggestFifoAllocation(open, 12000000), open, 'Sharda M.')).toBeNull();
  });

  it('requires who received the money', () => {
    expect(validateReceipt(100, [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 100 }], open, ' '))
      .toMatch(/who received/i);
  });
});

describe('buildReceipt', () => {
  it('records the allocation as given', () => {
    const r = buildReceipt(
      { id: 'c1', name: 'Shrutika D.' }, 5000000, 'Cash',
      [{ invoiceNumber: 'MUM-2026-1', amountPaisa: 5000000 }],
      'RCPT-2026-1', 'Sharda M.', '2026-08-06'
    );
    expect(r).toMatchObject({
      receiptNumber: 'RCPT-2026-1', amountPaisa: 5000000, receivedBy: 'Sharda M.',
    });
    expect(r.allocations).toHaveLength(1);
  });
});

describe('reporting', () => {
  const invoices = [
    invoice({ id: 'a', invoiceNumber: 'MUM-2026-1', date: '2026-07-25' }),   // 12 days
    invoice({ id: 'b', invoiceNumber: 'MUM-2026-2', date: '2026-06-01' }),   // 66 days
    invoice({ id: 'c', invoiceNumber: 'MUM-2026-3', date: '2026-08-05',
              customerId: 'c2', customerName: 'Ramesh K.' }),                 // 1 day
  ];
  const open = openInvoices(invoices, [], TODAY);
  const customers = [customer(), customer({ id: 'c2', name: 'Ramesh K.', creditLimit: 500 })];

  it('buckets the book and shares sum to 100%', () => {
    const rows = ageingSummary(open);
    expect(rows.reduce((s, r) => s + r.sharePercent, 0)).toBeCloseTo(100, 1);
    expect(rows.find(r => r.bucket === '61-90')?.invoices).toBe(1);
  });

  it('omits empty buckets', () => {
    expect(ageingSummary(open).every(r => r.invoices > 0)).toBe(true);
  });

  it('groups by customer, largest owing first', () => {
    const rows = customerBalances(open, customers);
    expect(rows[0].customerId).toBe('c1');
    expect(rows[0].invoices).toBe(2);
  });

  it('flags a customer past their limit', () => {
    const rows = customerBalances(open, customers);
    expect(rows.find(r => r.customerId === 'c2')?.overLimit).toBe(true);
  });

  it('reports the oldest bill per customer, for the collection call', () => {
    expect(customerBalances(open, customers)[0].oldestInvoiceDate).toBe('2026-06-01');
  });

  it('weights average age by amount, so one big old bill is not hidden', () => {
    const s = summariseReceivables(open, customers);
    expect(s.averageAgeDays).toBeGreaterThan(20);
    expect(s.openInvoices).toBe(3);
    expect(s.customersOwing).toBe(2);
  });

  it('counts what is past the credit period as overdue', () => {
    const s = summariseReceivables(open, customers, DEFAULT_CREDIT_DAYS);
    expect(s.overduePaisa).toBe(10300000);   // only the 66-day bill
  });

  it('handles an empty book', () => {
    expect(summariseReceivables([], [])).toMatchObject({
      totalOutstandingPaisa: 0, openInvoices: 0, averageAgeDays: 0,
    });
  });
});

describe('nextReceiptNumber', () => {
  it('continues from the highest, never the count', () => {
    const at = new Date('2026-08-06');
    expect(nextReceiptNumber([], at)).toBe('RCPT-2026-1');
    expect(nextReceiptNumber([{ receiptNumber: 'RCPT-2026-6' }] as CustomerReceipt[], at)).toBe('RCPT-2026-7');
  });
});
