import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useHardware } from '../contexts/HardwareContext';
import {
  measureStorage,
  buildHealthRows,
  overallLevel,
  buildBackup,
  formatBytes,
  ASSUMED_STORAGE_QUOTA_BYTES,
  type StorageUsage,
  type HealthLevel,
} from '../lib/systemHealth';
import { APP_VERSION, BUILD_TIME } from '../buildInfo';

interface SystemHealthPanelProps {
  forceOffline: boolean;
  latencyMs: number;
  queuedSales: number;
  queueConflicts: number;
}

const LEVEL_STYLE: Record<HealthLevel, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  OK: { icon: CheckCircle2, cls: 'text-emerald-500', label: 'Healthy' },
  WARN: { icon: AlertTriangle, cls: 'text-amber-500', label: 'Needs attention' },
  CRITICAL: { icon: AlertCircle, cls: 'text-rose-500', label: 'Action required' },
};

export default function SystemHealthPanel({
  forceOffline, latencyMs, queuedSales, queueConflicts,
}: SystemHealthPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { devices } = useHardware();

  const [storage, setStorage] = useState<StorageUsage>(() => measureStorage());
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(
    () => localStorage.getItem('stitch_last_backup_at')
  );

  /**
   * The browser's real quota when it offers one. `navigator.storage.estimate()` is async, so the
   * first render uses the conventional ceiling and this corrects it — labelled either way, since
   * a panel that presents an assumption as a measurement is the failure this milestone is about.
   */
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      let quota = ASSUMED_STORAGE_QUOTA_BYTES;
      let measured = false;
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (typeof est.quota === 'number' && est.quota > 0) { quota = est.quota; measured = true; }
        }
      } catch {
        // A browser that refuses the estimate is not an error worth surfacing; the fallback stands.
      }
      if (!cancelled) setStorage(measureStorage(localStorage, quota, measured));
    };
    void refresh();
    const id = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';

  const rows = buildHealthRows({
    storage, forceOffline, latencyMs,
    scaleStatus: devices.SCALE.status,
    printerStatus: devices.PRINTER.status,
    queuedSales, queueConflicts, lastBackupAt,
    appVersion: APP_VERSION, buildTime: BUILD_TIME,
  });
  const overall = overallLevel(rows);
  const OverallIcon = LEVEL_STYLE[overall].icon;

  const downloadBackup = () => {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stitch-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const at = backup.exportedAt;
    localStorage.setItem('stitch_last_backup_at', at);
    setLastBackupAt(at);
  };

  const topKeys = storage.entries.filter(e => e.isAppKey).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" /> System Health
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Every figure here is measured when the panel renders. Nothing on it is a placeholder —
              a status panel that lies is worse than none, because it is believed.
            </p>
          </div>
          <span className={`flex items-center gap-2 text-xs font-bold ${LEVEL_STYLE[overall].cls}`}>
            <OverallIcon className="w-4 h-4" /> {LEVEL_STYLE[overall].label}
          </span>
        </div>

        {/* Storage bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className={mutedCls}>Local storage</span>
            <span className="font-mono font-bold">
              {formatBytes(storage.totalBytes)} / {formatBytes(storage.quotaBytes)}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
            <div className={`h-full rounded-full transition-all ${
              storage.percentUsed >= 90 ? 'bg-rose-500'
                : storage.percentUsed >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} style={{ width: `${Math.max(0.5, storage.percentUsed)}%` }} />
          </div>
          <p className={`text-[10px] ${mutedCls}`}>
            {storage.quotaIsMeasured
              ? 'Quota reported by the browser.'
              : 'Browser gave no quota; the conventional 5 MB ceiling is assumed.'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Diagnostics</p>
          </div>
          <div className="p-4 space-y-2.5">
            {rows.map(r => {
              const Icon = LEVEL_STYLE[r.level].icon;
              return (
                <div key={r.label} className="flex items-start gap-2.5 text-[11px]">
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-px ${LEVEL_STYLE[r.level].cls}`} />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-3">
                      <span className="font-bold">{r.label}</span>
                      <span className="font-mono text-right">{r.value}</span>
                    </span>
                    {r.note && <span className={`block text-[10px] mt-0.5 ${mutedCls}`}>{r.note}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Largest Records</p>
            <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
              What is actually filling storage, so a quota warning names a cause.
            </p>
          </div>
          <div className="p-4 space-y-2">
            {topKeys.map(e => (
              <div key={e.key} className="flex justify-between text-[11px]">
                <span className={`font-mono truncate ${mutedCls}`}>{e.key}</span>
                <span className="font-mono font-bold shrink-0 ml-3">{formatBytes(e.bytes)}</span>
              </div>
            ))}
            {topKeys.length === 0 && (
              <p className={`py-6 text-center text-[11px] ${mutedCls}`}>No application data stored yet.</p>
            )}

            <div className={`pt-3 mt-1 border-t ${rowCls} space-y-2`}>
              <button onClick={downloadBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                <Download className="w-3.5 h-3.5" /> Export Backup
              </button>
              <p className={`text-[10px] leading-relaxed ${mutedCls}`}>
                Downloads every record as JSON. With no server, this file is the only copy that
                survives clearing site data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
