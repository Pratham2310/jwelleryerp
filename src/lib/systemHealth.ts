/**
 * System Health & Diagnostics (Milestone 51, PRD §16.4).
 *
 * The milestone's own criterion is that **nothing on the panel is a hardcoded placeholder**, which
 * is the only reason this is worth building in a prototype: a status panel that lies is worse than
 * no status panel, because it is believed. So every figure here is measured at call time —
 * storage is summed from the actual keys, the quota comes from the browser where it will give one,
 * and the build version is injected at build time rather than typed into a constant.
 *
 * The honest part is what it *doesn't* claim. There is no server, so there is no server health to
 * report; the API rows describe the simulation, and say so.
 */

/** Every key this app owns, so "other data" in the panel is genuinely other. */
export const APP_STORAGE_PREFIX = 'stitch_';

/** The conventional per-origin `localStorage` ceiling; used only when the browser offers no real figure. */
export const ASSUMED_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

export interface StorageEntry {
  key: string;
  bytes: number;
  /** True for keys this application wrote. */
  isAppKey: boolean;
}

export interface StorageUsage {
  entries: StorageEntry[];
  appBytes: number;
  otherBytes: number;
  totalBytes: number;
  quotaBytes: number;
  /** 0–100. Above ~80 a write can start failing, which in this app means silent data loss. */
  percentUsed: number;
  /** True when the browser gave a real quota rather than the assumed one. */
  quotaIsMeasured: boolean;
}

/**
 * UTF-16 code units are 2 bytes each in `localStorage`, and the key is stored alongside the value.
 * Counting only `value.length` would under-report by roughly half, which on a panel warning about
 * a quota is the difference between a useful number and a reassuring lie.
 */
export function entryBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

export function measureStorage(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'> = localStorage,
  quotaBytes: number = ASSUMED_STORAGE_QUOTA_BYTES,
  quotaIsMeasured = false
): StorageUsage {
  const entries: StorageEntry[] = [];

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null) continue;
    const value = storage.getItem(key) ?? '';
    entries.push({
      key,
      bytes: entryBytes(key, value),
      isAppKey: key.startsWith(APP_STORAGE_PREFIX),
    });
  }

  entries.sort((a, b) => b.bytes - a.bytes);
  const appBytes = entries.filter(e => e.isAppKey).reduce((s, e) => s + e.bytes, 0);
  const otherBytes = entries.filter(e => !e.isAppKey).reduce((s, e) => s + e.bytes, 0);
  const totalBytes = appBytes + otherBytes;

  return {
    entries,
    appBytes,
    otherBytes,
    totalBytes,
    quotaBytes,
    percentUsed: quotaBytes > 0 ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0,
    quotaIsMeasured,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  // Browsers commonly report a multi-gigabyte quota, and "10240.00 MB" is a figure nobody reads
  // as ten gigabytes.
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export type HealthLevel = 'OK' | 'WARN' | 'CRITICAL';

/**
 * Storage pressure. This matters more here than in a normal app: with no backend, a failed write
 * is not a degraded experience, it is a lost sale.
 */
export function storageLevel(percentUsed: number): HealthLevel {
  if (percentUsed >= 90) return 'CRITICAL';
  if (percentUsed >= 70) return 'WARN';
  return 'OK';
}

export interface HealthRow {
  label: string;
  value: string;
  level: HealthLevel;
  /** Says plainly when a row describes the simulation rather than real infrastructure. */
  note?: string;
}

export interface HealthInputs {
  storage: StorageUsage;
  forceOffline: boolean;
  latencyMs: number;
  scaleStatus: string;
  printerStatus: string;
  queuedSales: number;
  queueConflicts: number;
  lastBackupAt: string | null;
  appVersion: string;
  buildTime: string;
}

export function buildHealthRows(i: HealthInputs): HealthRow[] {
  const rows: HealthRow[] = [
    {
      label: 'Local storage used',
      value: `${formatBytes(i.storage.totalBytes)} of ${formatBytes(i.storage.quotaBytes)} (${i.storage.percentUsed.toFixed(1)}%)`,
      level: storageLevel(i.storage.percentUsed),
      note: i.storage.quotaIsMeasured
        ? 'Quota reported by the browser.'
        : 'Browser gave no quota; the conventional 5 MB ceiling is assumed.',
    },
    {
      label: 'Application data',
      value: `${formatBytes(i.storage.appBytes)} across ${i.storage.entries.filter(e => e.isAppKey).length} keys`,
      level: 'OK',
    },
    {
      label: 'Connection (simulated)',
      value: i.forceOffline ? 'Forced offline' : `Online · ${i.latencyMs} ms simulated latency`,
      level: i.forceOffline ? 'WARN' : 'OK',
      note: 'There is no server in this build. This reflects the Simulation Desk, not a network.',
    },
    {
      label: 'Unsynced sales',
      value: i.queueConflicts > 0
        ? `${i.queuedSales} pending, ${i.queueConflicts} in conflict`
        : `${i.queuedSales} pending`,
      level: i.queueConflicts > 0 ? 'CRITICAL' : i.queuedSales > 0 ? 'WARN' : 'OK',
      note: i.queuedSales + i.queueConflicts > 0
        ? 'These are missing from the register, the books and the GST returns until they sync.'
        : undefined,
    },
    {
      label: 'Digital scale',
      value: i.scaleStatus,
      level: i.scaleStatus === 'CONNECTED' ? 'OK' : 'WARN',
      note: 'Simulated peripheral (Milestone 35).',
    },
    {
      label: 'Thermal printer',
      value: i.printerStatus,
      level: i.printerStatus === 'CONNECTED' ? 'OK' : 'WARN',
      note: 'Simulated peripheral (Milestone 35).',
    },
    {
      label: 'Last backup',
      value: i.lastBackupAt ? i.lastBackupAt.slice(0, 16).replace('T', ' ') : 'Never',
      // Never having exported is a real risk when the only copy lives in one browser profile.
      level: i.lastBackupAt ? 'OK' : 'CRITICAL',
      note: i.lastBackupAt
        ? undefined
        : 'All data lives in this browser. Clearing site data would destroy it with no copy.',
    },
    {
      label: 'Build',
      value: `v${i.appVersion} · ${i.buildTime.slice(0, 16).replace('T', ' ')}`,
      level: 'OK',
    },
  ];
  return rows;
}

export function overallLevel(rows: HealthRow[]): HealthLevel {
  if (rows.some(r => r.level === 'CRITICAL')) return 'CRITICAL';
  if (rows.some(r => r.level === 'WARN')) return 'WARN';
  return 'OK';
}

/** Everything the app owns, as a JSON backup payload. */
export function buildBackup(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'> = localStorage
): { exportedAt: string; keys: number; data: Record<string, string> } {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || !key.startsWith(APP_STORAGE_PREFIX)) continue;
    data[key] = storage.getItem(key) ?? '';
  }
  return { exportedAt: new Date().toISOString(), keys: Object.keys(data).length, data };
}
