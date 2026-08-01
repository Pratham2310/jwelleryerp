import { describe, it, expect } from 'vitest';
import {
  queueSale,
  detectConflicts,
  resolveByRenumbering,
  syncQueue,
  summariseQueue,
  unsyncedWarning,
  type QueuedSale,
} from './offlineQueue';
import type { SaleInvoice } from '../types';

const invoice = (number: string, over: Partial<SaleInvoice> = {}): SaleInvoice => ({
  id: `inv-${number}`,
  invoiceType: 'TAX_INVOICE',
  invoiceNumber: number,
  date: '2026-08-01',
  customerName: 'Walk-in',
  customerPhone: 'N/A',
  items: [],
  oldGoldWeight: 0,
  oldGoldValue: 0,
  subtotal: 100000,
  tax: 3000,
  discount: 0,
  grandTotal: 103000,
  netAmountDue: 103000,
  paymentMethod: 'Cash',
  ...over,
} as SaleInvoice);

const queued = (number: string, at = '2026-08-01T10:00:00.000Z'): QueuedSale =>
  queueSale(invoice(number), at);

describe('queueSale', () => {
  it('queues a sale as pending, unsynced', () => {
    const q = queued('MUM-2026-1001');
    expect(q.status).toBe('PENDING');
    expect(q.syncedAt).toBeNull();
  });
});

describe('detectConflicts', () => {
  it('passes a clean bill through', () => {
    const [q] = detectConflicts([queued('MUM-2026-1005')], [invoice('MUM-2026-1001')]);
    expect(q.status).toBe('PENDING');
    expect(q.conflictReason).toBeUndefined();
  });

  it('flags a number already issued while the terminal was offline', () => {
    const [q] = detectConflicts([queued('MUM-2026-1001')], [invoice('MUM-2026-1001')]);
    expect(q.status).toBe('CONFLICT');
    expect(q.conflictReason).toMatch(/already issued/i);
  });

  it('flags two queued sales claiming the same number on one terminal', () => {
    const result = detectConflicts([queued('MUM-2026-1001'), queued('MUM-2026-1001')], []);
    expect(result[0].status).toBe('PENDING');
    expect(result[1].status).toBe('CONFLICT');
    expect(result[1].conflictReason).toMatch(/another queued sale/i);
  });

  it('leaves an already-synced entry alone', () => {
    const synced: QueuedSale = { ...queued('MUM-2026-1001'), status: 'SYNCED', syncedAt: 'x' };
    expect(detectConflicts([synced], [invoice('MUM-2026-1001')])[0].status).toBe('SYNCED');
  });

  it('clears a stale conflict once the collision is gone', () => {
    const stale: QueuedSale = {
      ...queued('MUM-2026-1009'), status: 'CONFLICT', conflictReason: 'old',
    };
    const [q] = detectConflicts([stale], []);
    expect(q.status).toBe('PENDING');
    expect(q.conflictReason).toBeUndefined();
  });
});

describe('resolveByRenumbering', () => {
  const conflicted = detectConflicts([queued('MUM-2026-1001')], [invoice('MUM-2026-1001')])[0];

  it('moves the number and clears the conflict', () => {
    const fixed = resolveByRenumbering(conflicted, 'MUM-2026-1002');
    expect(fixed.invoice.invoiceNumber).toBe('MUM-2026-1002');
    expect(fixed.status).toBe('PENDING');
  });

  it('KEEPS the original number, so the gap in the series explains itself', () => {
    expect(resolveByRenumbering(conflicted, 'MUM-2026-1002').originalInvoiceNumber)
      .toBe('MUM-2026-1001');
  });

  it('changes NOTHING else — the bill is a fiscal document, not a draft', () => {
    const fixed = resolveByRenumbering(conflicted, 'MUM-2026-1002');
    const { invoiceNumber: _a, ...restBefore } = conflicted.invoice;
    const { invoiceNumber: _b, ...restAfter } = fixed.invoice;
    expect(restAfter).toEqual(restBefore);
  });

  it('does not overwrite the original number when renumbered twice', () => {
    const once = resolveByRenumbering(conflicted, 'MUM-2026-1002');
    const twice = resolveByRenumbering(once, 'MUM-2026-1003');
    expect(twice.originalInvoiceNumber).toBe('MUM-2026-1001');
  });
});

describe('syncQueue', () => {
  it('commits a clean queue and marks it synced', () => {
    const r = syncQueue([queued('MUM-2026-1005')], [invoice('MUM-2026-1001')], 'T');
    expect(r.conflicts).toHaveLength(0);
    expect(r.invoicesToCommit).toHaveLength(1);
    expect(r.synced[0].syncedAt).toBe('T');
  });

  it('is PARTIAL — a clean bill lands even when another conflicts', () => {
    // Holding a good bill hostage to an unrelated conflict leaves the register understated
    // for as long as the conflict goes unresolved.
    const r = syncQueue(
      [queued('MUM-2026-1001'), queued('MUM-2026-1005')],
      [invoice('MUM-2026-1001')]
    );
    expect(r.conflicts).toHaveLength(1);
    expect(r.invoicesToCommit.map(i => i.invoiceNumber)).toEqual(['MUM-2026-1005']);
  });

  it('NEVER drops a conflicted sale — the customer already walked out with it', () => {
    const r = syncQueue([queued('MUM-2026-1001')], [invoice('MUM-2026-1001')]);
    expect(r.synced.length + r.conflicts.length).toBe(1);
    expect(r.invoicesToCommit).toHaveLength(0);
  });

  it('commits a renumbered bill on the next attempt', () => {
    const first = syncQueue([queued('MUM-2026-1001')], [invoice('MUM-2026-1001')]);
    const fixed = resolveByRenumbering(first.conflicts[0], 'MUM-2026-1002');
    const second = syncQueue([fixed], [invoice('MUM-2026-1001')]);
    expect(second.invoicesToCommit).toHaveLength(1);
    expect(second.conflicts).toHaveLength(0);
  });

  it('does not re-commit an entry that already synced', () => {
    const once = syncQueue([queued('MUM-2026-1005')], []);
    const twice = syncQueue(once.synced, once.invoicesToCommit);
    expect(twice.invoicesToCommit).toHaveLength(0);
  });
});

describe('summariseQueue', () => {
  it('summarises an empty queue', () => {
    expect(summariseQueue([])).toMatchObject({ pending: 0, conflicts: 0, pendingValue: 0, oldestPendingAt: null });
  });

  it('counts conflicted bills as unsynced money too', () => {
    // Counting only PENDING would make a stuck queue look harmless.
    const q = detectConflicts(
      [queued('MUM-2026-1001'), queued('MUM-2026-1005')],
      [invoice('MUM-2026-1001')]
    );
    const s = summariseQueue(q);
    expect(s.pending).toBe(1);
    expect(s.conflicts).toBe(1);
    expect(s.pendingValue).toBe(206000);
  });

  it('reports the oldest unsynced sale, not the newest', () => {
    const s = summariseQueue([
      queued('MUM-2026-1005', '2026-08-01T12:00:00.000Z'),
      queued('MUM-2026-1006', '2026-08-01T09:00:00.000Z'),
    ]);
    expect(s.oldestPendingAt).toBe('2026-08-01T09:00:00.000Z');
  });

  it('excludes synced bills from the outstanding value', () => {
    const r = syncQueue([queued('MUM-2026-1005')], []);
    expect(summariseQueue(r.synced).pendingValue).toBe(0);
  });
});

describe('unsyncedWarning', () => {
  it('says nothing when the queue is clear', () => {
    expect(unsyncedWarning([])).toBeNull();
  });

  it('names what the reports are missing, in money', () => {
    const w = unsyncedWarning([queued('MUM-2026-1005')]);
    expect(w).toMatch(/1 sale worth ₹1,03,000/);
    expect(w).toMatch(/missing from the register, the books and the GST returns/i);
  });

  it('pluralises', () => {
    expect(unsyncedWarning([queued('A'), queued('B')])).toMatch(/2 sales/);
  });
});
