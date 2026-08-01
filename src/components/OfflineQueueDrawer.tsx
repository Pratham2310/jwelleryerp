import { X, CloudOff, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { SaleInvoice } from '../types';
import {
  summariseQueue,
  resolveByRenumbering,
  unsyncedWarning,
  type QueuedSale,
} from '../lib/offlineQueue';

interface OfflineQueueDrawerProps {
  queue: QueuedSale[];
  setQueue: React.Dispatch<React.SetStateAction<QueuedSale[]>>;
  invoices: SaleInvoice[];
  /** Issues the next free number in the branch series, for renumbering a collided bill. */
  nextInvoiceNumber: () => string;
  onSync: () => void;
  isOffline: boolean;
  onClose: () => void;
}

/**
 * Conflict resolution for the offline queue (Milestone 36).
 *
 * A conflict is never resolved by discarding the sale — the customer has already walked out with
 * that bill. The only remedy offered is renumbering, and the original number stays on the record
 * so the gap in the series explains itself to whoever audits it later.
 */
export default function OfflineQueueDrawer({
  queue, setQueue, invoices, nextInvoiceNumber, onSync, isOffline, onClose,
}: OfflineQueueDrawerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';

  const summary = summariseQueue(queue);
  const warning = unsyncedWarning(queue);
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const renumber = (entry: QueuedSale) => {
    const taken = new Set([
      ...invoices.map(i => i.invoiceNumber),
      ...queue.filter(q => q.id !== entry.id).map(q => q.invoice.invoiceNumber),
    ]);
    // Walk forward until the series offers something genuinely free — the counter alone can
    // hand back a number another queued bill already claimed.
    let candidate = nextInvoiceNumber();
    let guard = 0;
    while (taken.has(candidate) && guard < 500) { candidate = nextInvoiceNumber(); guard += 1; }

    setQueue(prev => prev.map(q => (q.id === entry.id ? resolveByRenumbering(q, candidate) : q)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-end">
      <div className={`w-full max-w-xl h-full overflow-y-auto border-l shadow-2xl ${cardCls}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b ${cardCls} ${rowCls}`}>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-500" /> Offline Sales Queue
            </h3>
            <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
              {isOffline
                ? 'This terminal is offline. Sales are being held here until the connection returns.'
                : 'Online. Queued sales sync into the register.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close offline queue"
            className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pending', value: String(summary.pending) },
              { label: 'Conflicts', value: String(summary.conflicts), danger: summary.conflicts > 0 },
              { label: 'Synced', value: String(summary.synced) },
            ].map(k => (
              <div key={k.label} className={`p-4 rounded-xl border text-center ${
                k.danger ? 'border-rose-500/40 bg-rose-500/5'
                  : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
              }`}>
                <p className={`text-lg font-black font-mono ${k.danger ? 'text-rose-500' : ''}`}>{k.value}</p>
                <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Named in money, because that is what is actually missing from the books. */}
          {warning && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{warning}
            </p>
          )}

          <button
            onClick={onSync}
            disabled={isOffline || summary.pending === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isOffline ? 'Cannot sync while offline' : `Sync ${summary.pending} pending sale${summary.pending === 1 ? '' : 's'}`}
          </button>

          <div className="space-y-2">
            {queue.length === 0 && (
              <p className={`text-[11px] py-10 text-center ${mutedCls}`}>
                Nothing queued. Sales go straight to the register while the terminal is online.
              </p>
            )}

            {queue.map(entry => (
              <div key={entry.id} className={`p-3 rounded-xl border ${
                entry.status === 'CONFLICT' ? 'border-rose-500/40 bg-rose-500/5'
                  : entry.status === 'SYNCED' ? (dark ? 'border-zinc-800' : 'border-slate-150')
                  : 'border-amber-500/40 bg-amber-500/5'
              }`}>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold font-mono flex-1 min-w-0 truncate">
                    {entry.invoice.invoiceNumber}
                    {entry.originalInvoiceNumber && (
                      <span className={`font-normal ml-1.5 ${mutedCls}`}>
                        (was {entry.originalInvoiceNumber})
                      </span>
                    )}
                  </p>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                    entry.status === 'CONFLICT' ? 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : entry.status === 'SYNCED' ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'text-amber-700 dark:text-amber-400 border-amber-500/30'
                  }`}>
                    {entry.status === 'SYNCED' && <CheckCircle2 className="w-2.5 h-2.5 inline mr-1 -mt-px" />}
                    {entry.status}
                  </span>
                  <span className="font-mono text-xs font-bold shrink-0">{money(entry.invoice.grandTotal)}</span>
                </div>

                <p className={`text-[10px] mt-1 ${mutedCls}`}>
                  {entry.invoice.customerName} · queued {entry.queuedAt.slice(11, 16)}
                  {entry.syncedAt && ` · synced ${entry.syncedAt.slice(11, 16)}`}
                </p>

                {entry.status === 'CONFLICT' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 leading-relaxed">
                      {entry.conflictReason} Rule 46 requires a unique consecutive series, so this
                      bill needs a free number — its contents are not in question and stay as billed.
                    </p>
                    <button
                      onClick={() => renumber(entry)}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-[10px] font-bold text-rose-600 dark:text-rose-400 transition"
                    >
                      Renumber to next free
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
