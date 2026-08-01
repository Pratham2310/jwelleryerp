/**
 * Offline POS queue and sync (Milestone 36, PRD §16.3).
 *
 * ─── The real problem is not storage, it is the invoice number ────────────────────────
 * A counter that keeps selling through a network outage is the easy half — everything in this
 * build already lives in `localStorage`, so a queued sale survives a reload for free. The half
 * worth building carefully is what happens when it comes back.
 *
 * GST Rule 46 requires a **unique, consecutive** invoice series per GSTIN. An offline terminal
 * has no way to know that another counter has meanwhile issued the number it just used, so two
 * bills can come back bearing the same number. That is a compliance defect, not a UI annoyance,
 * and it is the conflict this module exists to detect.
 *
 * Three rules follow, and they are the reason this is a library with tests rather than a spinner:
 *
 *   1. **A queued sale is never dropped.** Discarding a bill the customer has already walked out
 *      with loses a real transaction and understates output GST. A conflict is resolved by
 *      renumbering, never by deletion.
 *   2. **The number is the only thing renumbering may change.** The items, weights, tax and
 *      tender are what actually happened at the counter; rewriting any of them to make a sync
 *      succeed would be falsifying a fiscal document.
 *   3. **The original number is kept** on the entry after renumbering. An auditor asking why the
 *      series jumps needs the answer to be in the record rather than in someone's memory.
 */

import type { SaleInvoice } from '../types';
import { roundMoney } from './money';

export type QueueStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';

export interface QueuedSale {
  id: string;
  /** The invoice exactly as raised at the counter. Never edited except to renumber. */
  invoice: SaleInvoice;
  status: QueueStatus;
  queuedAt: string;
  syncedAt: string | null;
  /** Set when a renumber happened, so the gap in the series is explained by the record itself. */
  originalInvoiceNumber?: string;
  conflictReason?: string;
}

export function queueSale(invoice: SaleInvoice, at: string = new Date().toISOString()): QueuedSale {
  return {
    id: `q-${invoice.id}`,
    invoice,
    status: 'PENDING',
    queuedAt: at,
    syncedAt: null,
  };
}

/* ─────────────────────────────── Conflict detection ─────────────────────────────── */

/**
 * A queued bill conflicts when its number is already live in the register, or when two entries
 * in the queue itself claim the same one. The in-queue check matters as much as the register
 * check: two offline terminals sharing a branch series collide with each other, not with the
 * server.
 */
export function detectConflicts(queue: QueuedSale[], invoices: SaleInvoice[]): QueuedSale[] {
  const taken = new Set(invoices.map(i => i.invoiceNumber));
  const seenInQueue = new Set<string>();

  return queue.map(entry => {
    if (entry.status === 'SYNCED') return entry;

    const number = entry.invoice.invoiceNumber;
    if (taken.has(number)) {
      return {
        ...entry,
        status: 'CONFLICT' as const,
        conflictReason: `${number} was already issued while this terminal was offline.`,
      };
    }
    if (seenInQueue.has(number)) {
      return {
        ...entry,
        status: 'CONFLICT' as const,
        conflictReason: `${number} is claimed by another queued sale on this terminal.`,
      };
    }
    seenInQueue.add(number);
    return { ...entry, status: 'PENDING' as const, conflictReason: undefined };
  });
}

/**
 * Renumbers a conflicted entry onto a free number. The bill's contents are untouched — only the
 * number moves, and the number it moved from is kept.
 */
export function resolveByRenumbering(entry: QueuedSale, nextNumber: string): QueuedSale {
  return {
    ...entry,
    invoice: { ...entry.invoice, invoiceNumber: nextNumber },
    originalInvoiceNumber: entry.originalInvoiceNumber ?? entry.invoice.invoiceNumber,
    status: 'PENDING',
    conflictReason: undefined,
  };
}

export interface SyncResult {
  /** Entries that went through, in the order they were queued. */
  synced: QueuedSale[];
  /** Entries still needing a decision. Sync is not "all or nothing" — a clean bill should land. */
  conflicts: QueuedSale[];
  /** The invoices to append to the register. */
  invoicesToCommit: SaleInvoice[];
}

/**
 * Syncs what can be synced and leaves the rest flagged.
 *
 * Deliberately partial: holding a clean bill hostage to an unrelated conflict would leave the
 * register understated for as long as the conflict goes unresolved, which is the opposite of
 * what an accounting system should do when it already knows about the sale.
 */
export function syncQueue(
  queue: QueuedSale[],
  invoices: SaleInvoice[],
  at: string = new Date().toISOString()
): SyncResult {
  const checked = detectConflicts(queue, invoices);
  const synced: QueuedSale[] = [];
  const conflicts: QueuedSale[] = [];
  const invoicesToCommit: SaleInvoice[] = [];

  for (const entry of checked) {
    if (entry.status === 'SYNCED') { synced.push(entry); continue; }
    if (entry.status === 'CONFLICT') { conflicts.push(entry); continue; }
    synced.push({ ...entry, status: 'SYNCED', syncedAt: at });
    invoicesToCommit.push(entry.invoice);
  }

  return { synced, conflicts, invoicesToCommit };
}

/* ─────────────────────────────── Presentation ─────────────────────────────── */

export interface QueueSummary {
  pending: number;
  conflicts: number;
  synced: number;
  /** Money sitting in the queue and therefore missing from every report until it syncs. */
  pendingValue: number;
  oldestPendingAt: string | null;
}

export function summariseQueue(queue: QueuedSale[]): QueueSummary {
  const pending = queue.filter(q => q.status === 'PENDING');
  const conflicts = queue.filter(q => q.status === 'CONFLICT');
  // Conflicted bills are unsynced money too — counting only PENDING would understate what is
  // missing from the books and make a stuck queue look harmless.
  const unsynced = [...pending, ...conflicts];

  return {
    pending: pending.length,
    conflicts: conflicts.length,
    synced: queue.filter(q => q.status === 'SYNCED').length,
    pendingValue: roundMoney(unsynced.reduce((sum, q) => sum + (q.invoice.grandTotal || 0), 0)),
    oldestPendingAt: unsynced.length
      ? unsynced.map(q => q.queuedAt).sort()[0]
      : null,
  };
}

/**
 * Sales sitting in a queue are invisible to the Day Book, GSTR-1 and every report built on the
 * invoice register. Anything reading those figures while the queue is non-empty is reading an
 * understatement, and should say so rather than quietly disagree with the till.
 */
export function unsyncedWarning(queue: QueuedSale[]): string | null {
  const s = summariseQueue(queue);
  const stuck = s.pending + s.conflicts;
  if (stuck === 0) return null;
  return `${stuck} sale${stuck === 1 ? '' : 's'} worth ₹${s.pendingValue.toLocaleString('en-IN')} `
    + 'have not synced yet and are missing from the register, the books and the GST returns.';
}
