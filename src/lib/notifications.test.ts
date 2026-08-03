import { describe, it, expect } from 'vitest';
import {
  MAX_NOTIFICATIONS,
  CATEGORY_LABEL,
  buildNotification,
  pushNotification,
  markRead,
  markAllRead,
  unreadCount,
  byCategory,
  sortForDisplay,
  summariseNotifications,
  relativeTime,
  NOTIFY,
  type AppNotification,
} from './notifications';

const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1', category: 'SALE', severity: 'INFO', title: 't', body: 'b',
  at: '2026-08-03T10:00:00.000Z', read: false, ...over,
});

describe('buildNotification', () => {
  it('starts unread and defaults to INFO', () => {
    const n = buildNotification({ category: 'SALE', title: 't', body: 'b' }, 'T');
    expect(n.read).toBe(false);
    expect(n.severity).toBe('INFO');
    expect(n.at).toBe('T');
  });

  it('gives every event a distinct id, even within the same millisecond', () => {
    const a = buildNotification({ category: 'SALE', title: 't', body: 'b' }, 'T');
    const b = buildNotification({ category: 'SALE', title: 't', body: 'b' }, 'T');
    expect(a.id).not.toBe(b.id);
  });
});

describe('pushNotification', () => {
  it('adds newest first', () => {
    const list = pushNotification(pushNotification([], { category: 'SALE', title: 'first', body: 'b' }),
      { category: 'SALE', title: 'second', body: 'b' });
    expect(list[0].title).toBe('second');
  });

  it('caps the list', () => {
    let list: AppNotification[] = [];
    for (let i = 0; i < MAX_NOTIFICATIONS + 20; i++) {
      list = pushNotification(list, { category: 'SALE', title: `n${i}`, body: 'b' });
      list = markAllRead(list);
    }
    expect(list.length).toBeLessThanOrEqual(MAX_NOTIFICATIONS);
  });

  it('NEVER evicts an unread event to make room for a read one', () => {
    // A busy afternoon of sales must not push out the one notification that mattered.
    const critical = note({ id: 'keep', severity: 'CRITICAL', title: 'sync failed', read: false });
    let list: AppNotification[] = [critical];
    for (let i = 0; i < MAX_NOTIFICATIONS + 30; i++) {
      list = pushNotification(list, { category: 'SALE', title: `sale ${i}`, body: 'b' });
      // Everything except the critical one gets read.
      list = list.map(n => (n.id === 'keep' ? n : { ...n, read: true }));
    }
    expect(list.some(n => n.id === 'keep')).toBe(true);
    expect(list.length).toBeLessThanOrEqual(MAX_NOTIFICATIONS);
  });

  it('keeps the cap even when everything is unread', () => {
    let list: AppNotification[] = [];
    for (let i = 0; i < MAX_NOTIFICATIONS + 10; i++) {
      list = pushNotification(list, { category: 'SALE', title: `n${i}`, body: 'b' });
    }
    expect(list).toHaveLength(MAX_NOTIFICATIONS);
    expect(unreadCount(list)).toBe(MAX_NOTIFICATIONS);
  });
});

describe('reading', () => {
  const list = [note({ id: 'a' }), note({ id: 'b' }), note({ id: 'c', read: true })];

  it('counts unread', () => {
    expect(unreadCount(list)).toBe(2);
  });

  it('marks one read without touching the rest', () => {
    const after = markRead(list, 'a');
    expect(after.find(n => n.id === 'a')?.read).toBe(true);
    expect(after.find(n => n.id === 'b')?.read).toBe(false);
  });

  it('marks all read', () => {
    expect(unreadCount(markAllRead(list))).toBe(0);
  });

  it('never edits an event beyond its read flag', () => {
    const after = markRead(list, 'a');
    const { read: _r1, ...restBefore } = list[0];
    const { read: _r2, ...restAfter } = after[0];
    expect(restAfter).toEqual(restBefore);
  });
});

describe('sortForDisplay', () => {
  it('puts unread before read', () => {
    const rows = sortForDisplay([note({ id: 'r', read: true }), note({ id: 'u', read: false })]);
    expect(rows[0].id).toBe('u');
  });

  it('ranks a critical unread above a newer routine unread', () => {
    // The panel exists to surface what needs attention, not to be a chronological log.
    const rows = sortForDisplay([
      note({ id: 'new', severity: 'INFO', at: '2026-08-03T12:00:00.000Z' }),
      note({ id: 'crit', severity: 'CRITICAL', at: '2026-08-03T09:00:00.000Z' }),
    ]);
    expect(rows[0].id).toBe('crit');
  });

  it('falls back to newest first within a severity', () => {
    const rows = sortForDisplay([
      note({ id: 'old', at: '2026-08-03T09:00:00.000Z' }),
      note({ id: 'new', at: '2026-08-03T12:00:00.000Z' }),
    ]);
    expect(rows[0].id).toBe('new');
  });

  it('does not mutate the input', () => {
    const input = [note({ id: 'a', read: true }), note({ id: 'b' })];
    sortForDisplay(input);
    expect(input[0].id).toBe('a');
  });
});

describe('filtering & summary', () => {
  const list = [
    note({ id: 'a', category: 'SALE' }),
    note({ id: 'b', category: 'STOCK', read: true }),
    note({ id: 'c', category: 'COMPLIANCE', severity: 'CRITICAL' }),
  ];

  it('filters by category, and ALL passes everything', () => {
    expect(byCategory(list, 'STOCK')).toHaveLength(1);
    expect(byCategory(list, 'ALL')).toHaveLength(3);
  });

  it('summarises totals, unread and unread criticals', () => {
    const s = summariseNotifications(list);
    expect(s).toMatchObject({ total: 3, unread: 2, critical: 1 });
  });

  it('omits categories with nothing in them', () => {
    expect(summariseNotifications(list).byCategory).toHaveLength(3);
  });

  it('stops counting a critical once it is read', () => {
    expect(summariseNotifications(markAllRead(list)).critical).toBe(0);
  });

  it('labels every category', () => {
    expect(Object.keys(CATEGORY_LABEL)).toHaveLength(5);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');

  it('reads naturally across the ranges', () => {
    expect(relativeTime('2026-08-03T11:59:30.000Z', now)).toBe('just now');
    expect(relativeTime('2026-08-03T11:30:00.000Z', now)).toBe('30m ago');
    expect(relativeTime('2026-08-03T09:00:00.000Z', now)).toBe('3h ago');
    expect(relativeTime('2026-08-01T12:00:00.000Z', now)).toBe('2d ago');
  });

  it('returns empty for an unparseable timestamp rather than "NaN ago"', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});

describe('NOTIFY builders', () => {
  it('names a sale with its number and value', () => {
    const n = NOTIFY.saleCompleted('MUM-2026-1001', 66568);
    expect(n.title).toContain('MUM-2026-1001');
    expect(n.body).toContain('66,568');
  });

  it('raises a sync conflict as CRITICAL — it is a compliance problem, not a notice', () => {
    expect(NOTIFY.syncConflict('MUM-2026-1001').severity).toBe('CRITICAL');
    expect(NOTIFY.syncConflict('MUM-2026-1001').category).toBe('COMPLIANCE');
  });

  it('mentions ITC reversal on a write-off only when it applies', () => {
    expect(NOTIFY.stockWrittenOff('ADJ-1', 50000, true).body).toMatch(/17\(5\)\(h\)/);
    expect(NOTIFY.stockWrittenOff('ADJ-1', 50000, false).body).not.toMatch(/17\(5\)\(h\)/);
  });

  it('escalates a melt only when it needs review', () => {
    expect(NOTIFY.meltCompleted('M1', 20, false).severity).toBe('INFO');
    expect(NOTIFY.meltCompleted('M1', 20, true).severity).toBe('WARNING');
  });

  it('names the approver on an approval', () => {
    expect(NOTIFY.supervisorApproval('Large discount', 40000, 'Sharda M.').body).toContain('Sharda M.');
  });
});
