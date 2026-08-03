import { X, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import type { AppNotification } from '../lib/notifications';

/**
 * The Toast primitive flagged as missing in `CURRENT_PROGRESS.md` §3.6 (Milestone 50).
 *
 * Always dark, like the Simulation Desk: a toast floats over both themes and needs to read the
 * same way on either. A CRITICAL toast has no auto-dismiss — see `NotificationContext`.
 */

const STYLE: Record<AppNotification['severity'], { border: string; icon: typeof AlertCircle; tint: string }> = {
  INFO: { border: 'border-[#C5A059]/40', icon: CheckCircle2, tint: 'text-[#C5A059]' },
  WARNING: { border: 'border-amber-500/50', icon: AlertTriangle, tint: 'text-amber-400' },
  CRITICAL: { border: 'border-rose-500/60', icon: AlertCircle, tint: 'text-rose-400' },
};

export default function ToastStack() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => {
        const s = STYLE[t.severity];
        const Icon = s.icon;
        return (
          <div key={t.id}
            className={`flex items-start gap-2.5 p-3 rounded-xl border bg-[#141416]/97 backdrop-blur-sm shadow-2xl shadow-black/60 ${s.border}`}>
            <Icon className={`w-4 h-4 shrink-0 mt-px ${s.tint}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-zinc-100">{t.title}</p>
              <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">{t.body}</p>
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label={`Dismiss ${t.title}`}
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 transition shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
