import { describe, it, expect } from 'vitest';
import {
  APP_STORAGE_PREFIX,
  ASSUMED_STORAGE_QUOTA_BYTES,
  entryBytes,
  measureStorage,
  formatBytes,
  storageLevel,
  buildHealthRows,
  overallLevel,
  buildBackup,
  type HealthInputs,
} from './systemHealth';

/** A minimal in-memory stand-in for `localStorage`, so the tests never touch a real one. */
function fakeStorage(data: Record<string, string>) {
  const keys = Object.keys(data);
  return {
    length: keys.length,
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => (k in data ? data[k] : null),
  };
}

const inputs = (over: Partial<HealthInputs> = {}): HealthInputs => ({
  storage: measureStorage(fakeStorage({ [`${APP_STORAGE_PREFIX}tags`]: 'x'.repeat(100) })),
  forceOffline: false,
  latencyMs: 600,
  scaleStatus: 'CONNECTED',
  printerStatus: 'CONNECTED',
  queuedSales: 0,
  queueConflicts: 0,
  lastBackupAt: '2026-08-03T10:00:00.000Z',
  appVersion: '1.4.0',
  buildTime: '2026-08-03T09:00:00.000Z',
  ...over,
});

describe('entryBytes', () => {
  it('counts UTF-16 code units and the key, not just the value length', () => {
    // Counting value.length alone under-reports by roughly half, which on a quota warning
    // is the difference between a useful number and a reassuring lie.
    expect(entryBytes('ab', 'cd')).toBe(8);
  });
});

describe('measureStorage', () => {
  const storage = fakeStorage({
    [`${APP_STORAGE_PREFIX}tags`]: 'x'.repeat(1000),
    [`${APP_STORAGE_PREFIX}invoices`]: 'y'.repeat(500),
    'someone_elses_key': 'z'.repeat(200),
  });

  it('separates this app\'s keys from everything else', () => {
    const u = measureStorage(storage);
    expect(u.appBytes).toBeGreaterThan(u.otherBytes);
    expect(u.entries.filter(e => e.isAppKey)).toHaveLength(2);
  });

  it('totals to app plus other', () => {
    const u = measureStorage(storage);
    expect(u.totalBytes).toBe(u.appBytes + u.otherBytes);
  });

  it('lists the largest key first, so the panel names what is filling storage', () => {
    expect(measureStorage(storage).entries[0].key).toBe(`${APP_STORAGE_PREFIX}tags`);
  });

  it('falls back to the conventional quota and says it is assumed', () => {
    const u = measureStorage(storage);
    expect(u.quotaBytes).toBe(ASSUMED_STORAGE_QUOTA_BYTES);
    expect(u.quotaIsMeasured).toBe(false);
  });

  it('uses a measured quota when the browser gives one', () => {
    const u = measureStorage(storage, 12345678, true);
    expect(u.quotaBytes).toBe(12345678);
    expect(u.quotaIsMeasured).toBe(true);
  });

  it('handles empty storage without dividing by zero', () => {
    const u = measureStorage(fakeStorage({}));
    expect(u.totalBytes).toBe(0);
    expect(u.percentUsed).toBe(0);
  });

  it('never reports over 100%', () => {
    const u = measureStorage(fakeStorage({ big: 'x'.repeat(10000) }), 100);
    expect(u.percentUsed).toBe(100);
  });
});

describe('formatBytes', () => {
  it('scales the unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });

  it('reaches gigabytes — browsers report multi-GB quotas', () => {
    // "10240.00 MB" is a figure nobody reads as ten gigabytes.
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10.00 GB');
  });
});

describe('storageLevel', () => {
  it('escalates as the quota fills', () => {
    // With no backend a failed write is not a degraded experience, it is a lost sale.
    expect(storageLevel(10)).toBe('OK');
    expect(storageLevel(75)).toBe('WARN');
    expect(storageLevel(95)).toBe('CRITICAL');
  });
});

describe('buildHealthRows — nothing is a placeholder', () => {
  it('reports every row with a real value', () => {
    const rows = buildHealthRows(inputs());
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const r of rows) expect(r.value.length).toBeGreaterThan(0);
  });

  it('reflects Force Offline honestly, and says there is no real server', () => {
    const rows = buildHealthRows(inputs({ forceOffline: true }));
    const conn = rows.find(r => r.label.startsWith('Connection'))!;
    expect(conn.value).toMatch(/forced offline/i);
    expect(conn.level).toBe('WARN');
    expect(conn.note).toMatch(/no server in this build/i);
  });

  it('treats a sync conflict as critical', () => {
    const rows = buildHealthRows(inputs({ queuedSales: 2, queueConflicts: 1 }));
    const q = rows.find(r => r.label === 'Unsynced sales')!;
    expect(q.level).toBe('CRITICAL');
    expect(q.note).toMatch(/missing from the register/i);
  });

  it('treats never having backed up as critical, and says why', () => {
    const rows = buildHealthRows(inputs({ lastBackupAt: null }));
    const b = rows.find(r => r.label === 'Last backup')!;
    expect(b.value).toBe('Never');
    expect(b.level).toBe('CRITICAL');
    expect(b.note).toMatch(/clearing site data would destroy it/i);
  });

  it('flags a disconnected peripheral without pretending it is fine', () => {
    const rows = buildHealthRows(inputs({ scaleStatus: 'DISCONNECTED' }));
    expect(rows.find(r => r.label === 'Digital scale')!.level).toBe('WARN');
  });

  it('reports a real build version rather than a constant in the panel', () => {
    const rows = buildHealthRows(inputs({ appVersion: '9.9.9' }));
    expect(rows.find(r => r.label === 'Build')!.value).toContain('9.9.9');
  });
});

describe('overallLevel', () => {
  it('takes the worst row', () => {
    expect(overallLevel(buildHealthRows(inputs()))).toBe('OK');
    expect(overallLevel(buildHealthRows(inputs({ queueConflicts: 1 })))).toBe('CRITICAL');
    expect(overallLevel(buildHealthRows(inputs({ forceOffline: true })))).toBe('WARN');
  });
});

describe('buildBackup', () => {
  const storage = fakeStorage({
    [`${APP_STORAGE_PREFIX}tags`]: '[1,2]',
    'unrelated': 'nope',
  });

  it('exports only this app\'s keys', () => {
    const b = buildBackup(storage);
    expect(b.keys).toBe(1);
    expect(b.data[`${APP_STORAGE_PREFIX}tags`]).toBe('[1,2]');
    expect(b.data.unrelated).toBeUndefined();
  });

  it('stamps when it was taken', () => {
    expect(buildBackup(storage).exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
