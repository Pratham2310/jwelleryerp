/**
 * Notification Center & Activity Feed (Milestone 50, PRD §14.10).
 *
 * Replaces `Header.tsx`'s hardcoded dropdown with real events.
 *
 * ─── An event is a record of something that happened ──────────────────────────────────
 * These are not reminders or UI hints — each one marks a state change the shop made: a sale
 * completed, stock written off, a queued bill that failed to sync. That makes the feed an audit
 * surface as much as a convenience, which drives three rules:
 *
 *   1. **Notifications are append-only.** Nothing edits an event after the fact; reading it only
 *      flips `read`.
 *   2. **The cap never silently drops an unread event.** Trimming by pure recency would let a
 *      busy afternoon of sales evict the one notification that mattered — a failed sync or a
 *      hallmarking block. Read events are evicted first, and unread ones survive until the list
 *      is entirely unread.
 *   3. **Severity is not category.** A sale and a failed sync are both "events"; only one needs
 *      attention. The Header badge counts *unread*, but the panel sorts attention-worthy first.
 */

export type NotificationCategory = 'SALE' | 'STOCK' | 'PURCHASE' | 'COMPLIANCE' | 'SYSTEM';
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Where clicking it should go, when there is somewhere useful. */
  href?: string;
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  SALE: 'Sales',
  STOCK: 'Inventory',
  PURCHASE: 'Purchases',
  COMPLIANCE: 'Compliance',
  SYSTEM: 'System',
};

/** Kept deliberately small: this is a browser-resident log, not an event store. */
export const MAX_NOTIFICATIONS = 60;

const SEVERITY_RANK: Record<NotificationSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export interface NotificationInput {
  category: NotificationCategory;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  href?: string;
}

export function buildNotification(
  input: NotificationInput,
  at: string = new Date().toISOString()
): AppNotification {
  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: input.category,
    severity: input.severity ?? 'INFO',
    title: input.title,
    body: input.body,
    href: input.href,
    at,
    read: false,
  };
}

/**
 * Adds an event and trims to the cap, **evicting read events before unread ones**.
 *
 * A shop that raises forty invoices in an afternoon must not lose the one notification saying a
 * bill failed to sync, which is exactly what trimming by recency alone would do.
 */
export function pushNotification(
  list: AppNotification[],
  input: NotificationInput,
  at?: string
): AppNotification[] {
  const next = [buildNotification(input, at), ...list];
  if (next.length <= MAX_NOTIFICATIONS) return next;

  const unread = next.filter(n => !n.read);
  const read = next.filter(n => n.read);
  const keepRead = Math.max(0, MAX_NOTIFICATIONS - unread.length);

  // Newest-first order is preserved by filtering the original array rather than concatenating.
  const survivingRead = new Set(read.slice(0, keepRead).map(n => n.id));
  return next
    .filter(n => !n.read || survivingRead.has(n.id))
    .slice(0, MAX_NOTIFICATIONS);
}

export function markRead(list: AppNotification[], id: string): AppNotification[] {
  return list.map(n => (n.id === id ? { ...n, read: true } : n));
}

export function markAllRead(list: AppNotification[]): AppNotification[] {
  return list.map(n => (n.read ? n : { ...n, read: true }));
}

export function unreadCount(list: AppNotification[]): number {
  return list.filter(n => !n.read).length;
}

export function byCategory(
  list: AppNotification[], category: NotificationCategory | 'ALL'
): AppNotification[] {
  return category === 'ALL' ? list : list.filter(n => n.category === category);
}

/**
 * Unread first, then by severity, then newest. A critical unread event outranks a newer routine
 * one — the panel exists to surface what needs attention, not to be a chronological log.
 */
export function sortForDisplay(list: AppNotification[]): AppNotification[] {
  return [...list].sort((a, b) =>
    Number(a.read) - Number(b.read)
    || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || b.at.localeCompare(a.at)
  );
}

export interface NotificationSummary {
  total: number;
  unread: number;
  critical: number;
  byCategory: { category: NotificationCategory; total: number; unread: number }[];
}

export function summariseNotifications(list: AppNotification[]): NotificationSummary {
  const categories: NotificationCategory[] = ['SALE', 'STOCK', 'PURCHASE', 'COMPLIANCE', 'SYSTEM'];
  return {
    total: list.length,
    unread: unreadCount(list),
    critical: list.filter(n => n.severity === 'CRITICAL' && !n.read).length,
    byCategory: categories
      .map(category => {
        const rows = list.filter(n => n.category === category);
        return { category, total: rows.length, unread: rows.filter(n => !n.read).length };
      })
      .filter(c => c.total > 0),
  };
}

/** Relative time for the feed. Absolute timestamps stay on the row for anything auditable. */
export function relativeTime(at: string, now: Date = new Date()): string {
  const then = new Date(at).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/* ─────────────────────────────── Event builders ─────────────────────────────── */

/**
 * Named builders rather than call sites assembling strings, so the same event always reads the
 * same way wherever it is raised.
 */
export const NOTIFY = {
  saleCompleted: (invoiceNo: string, total: number): NotificationInput => ({
    category: 'SALE', severity: 'INFO',
    title: `Invoice ${invoiceNo} raised`,
    body: `₹${total.toLocaleString('en-IN')} billed and posted to the register.`,
    href: '#/billing?tab=history',
  }),
  saleQueuedOffline: (invoiceNo: string, total: number): NotificationInput => ({
    category: 'SALE', severity: 'WARNING',
    title: `${invoiceNo} held offline`,
    body: `₹${total.toLocaleString('en-IN')} is in the sync queue and not yet in the register.`,
  }),
  syncConflict: (invoiceNo: string): NotificationInput => ({
    category: 'COMPLIANCE', severity: 'CRITICAL',
    title: `${invoiceNo} could not sync`,
    body: 'That invoice number was issued elsewhere while this terminal was offline. It needs renumbering.',
  }),
  stockWrittenOff: (adjustmentNo: string, value: number, itcReversed: boolean): NotificationInput => ({
    category: 'STOCK', severity: 'WARNING',
    title: `Stock written off — ${adjustmentNo}`,
    body: `₹${value.toLocaleString('en-IN')} removed from stock.`
      + (itcReversed ? ' Input tax credit must be reversed (s.17(5)(h)).' : ''),
    href: '#/inventory',
  }),
  meltCompleted: (batchNo: string, recovered: number, needsReview: boolean): NotificationInput => ({
    category: 'STOCK', severity: needsReview ? 'WARNING' : 'INFO',
    title: `Melt ${batchNo} completed`,
    body: `${recovered.toFixed(3)} g fine recovered.`
      + (needsReview ? ' Loss is above tolerance and the batch is flagged for review.' : ''),
    href: '#/inventory',
  }),
  supervisorApproval: (kind: string, amount: number, approver: string): NotificationInput => ({
    category: 'COMPLIANCE', severity: 'WARNING',
    title: `${kind} approved`,
    body: `₹${Math.abs(amount).toLocaleString('en-IN')} authorised by ${approver}.`,
    href: '#/roles',
  }),
  rateChanged: (metal: string, rate: number): NotificationInput => ({
    category: 'SYSTEM', severity: 'INFO',
    title: `${metal} rate updated`,
    body: `Now ₹${rate.toLocaleString('en-IN')} per gram.`,
  }),
} as const;
