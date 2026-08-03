import React, { useState } from 'react';
import { ClipboardX, Plus, X, AlertCircle, Info } from 'lucide-react';
import type { Tag, MetalRate, Branch } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  ADJUSTMENT_REASONS,
  reasonDef,
  isAdjustable,
  adjustmentValue,
  adjustmentWeight,
  validateAdjustment,
  buildAdjustment,
  applyAdjustment,
  summariseAdjustments,
  nextAdjustmentNumber,
  type StockAdjustment,
  type AdjustmentReason,
} from '../lib/stockAdjustment';

interface StockAdjustmentPanelProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  adjustments: StockAdjustment[];
  setAdjustments: React.Dispatch<React.SetStateAction<StockAdjustment[]>>;
  metalRates: MetalRate[];
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

export default function StockAdjustmentPanel({
  tags, setTags, adjustments, setAdjustments, metalRates, activeBranch, currentUserName, canManage,
}: StockAdjustmentPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isOpen, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reason, setReason] = useState<AdjustmentReason>('DAMAGED');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const eligible = tags.filter(t => isAdjustable(t.status));
  const selected = tags.filter(t => selectedIds.includes(t.id));
  const summary = summariseAdjustments(adjustments);
  const def = reasonDef(reason);

  const reset = () => {
    setOpen(false); setSelectedIds([]); setReason('DAMAGED'); setNote(''); setError('');
  };

  const submit = () => {
    const draft = { tagIds: selectedIds, reason, note, adjustedBy: currentUserName };
    const err = validateAdjustment(draft, tags);
    if (err) { setError(err); return; }

    const adjustment = buildAdjustment(
      draft, tags, metalRates, nextAdjustmentNumber(adjustments),
      new Date().toISOString().slice(0, 10), activeBranch?.id
    );
    setAdjustments(prev => [adjustment, ...prev]);
    setTags(prev => applyAdjustment(adjustment, prev));
    reset();
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ClipboardX className="w-4 h-4 text-amber-500" /> Stock Adjustment & Write-Off
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Takes a piece out of sellable stock and valuation — without deleting the record of
              what happened to it.
            </p>
          </div>
          <button onClick={() => setOpen(true)} disabled={!canManage || eligible.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Adjustment
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Vouchers', value: String(summary.count) },
            { label: 'Value Written Off', value: money(summary.totalValue), danger: summary.totalValue > 0 },
            { label: 'Weight Written Off', value: `${summary.totalWeight.toFixed(3)} g` },
            { label: 'ITC Reversal Base', value: money(summary.itcToReverse), warn: summary.itcToReverse > 0 },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.danger ? 'border-rose-500/40 bg-rose-500/5'
                : k.warn ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.danger ? 'text-rose-500' : k.warn ? 'text-amber-500' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            GST s.17(5)(h) blocks input tax credit on goods lost, stolen or destroyed, so credit
            claimed on a written-off piece has to be reversed. A <span className="font-bold">book
            correction is different</span> — nothing was destroyed, so nothing is reversed. The
            base above excludes corrections for exactly that reason.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Adjustment Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Voucher</th>
                <th className="px-4">Date</th>
                <th className="px-4">Reason</th>
                <th className="px-4 text-right">Pieces</th>
                <th className="px-4 text-right">Weight</th>
                <th className="px-4 text-right">Value</th>
                <th className="px-4">ITC</th>
                <th className="px-4">Note</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {adjustments.map(a => (
                <tr key={a.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3 px-4 font-mono font-bold text-[11px]">{a.adjustmentNo}</td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{a.date}</td>
                  <td className="px-4 text-[11px]">{reasonDef(a.reason).label}</td>
                  <td className="px-4 text-right font-mono">{a.tagIds.length}</td>
                  <td className="px-4 text-right font-mono">{a.weightWrittenOff.toFixed(3)} g</td>
                  <td className="px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    {money(a.valueWrittenOff)}
                  </td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      a.itcReversed
                        ? 'text-amber-700 dark:text-amber-400 border-amber-500/30'
                        : `${mutedCls} border-slate-200 dark:border-zinc-700`
                    }`}>
                      {a.itcReversed ? 'REVERSED' : 'N/A'}
                    </span>
                  </td>
                  <td className={`px-4 text-[11px] max-w-xs ${mutedCls}`}>
                    {a.note}
                    <span className="block text-[9px]">by {a.adjustedBy}</span>
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && (
                <tr><td colSpan={8} className={`py-10 text-center ${mutedCls}`}>
                  No stock adjustments recorded.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl my-8 rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">New Stock Adjustment</h3>
              <button onClick={reset} aria-label="Close adjustment"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Reason</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ADJUSTMENT_REASONS.map(r => (
                    <button key={r.key} onClick={() => { setReason(r.key); setError(''); }}
                      className={`text-left p-3 rounded-xl border transition ${
                        reason === r.key
                          ? 'border-amber-500/60 bg-amber-500/10'
                          : dark ? 'border-zinc-800 hover:border-zinc-700' : 'border-slate-150 hover:border-slate-300'
                      }`}>
                      <p className="text-[11px] font-bold">{r.label}</p>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${mutedCls}`}>{r.note}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Pieces ({selectedIds.length} selected)
                </label>
                <div className={`max-h-56 overflow-y-auto rounded-xl border divide-y ${rowCls} ${dark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                  {eligible.map(t => (
                    <label key={t.id} className={`flex items-center gap-3 p-2.5 cursor-pointer ${
                      dark ? 'hover:bg-zinc-900/50' : 'hover:bg-slate-50'
                    }`}>
                      <input type="checkbox" checked={selectedIds.includes(t.id)}
                        onChange={() => {
                          setSelectedIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]);
                          setError('');
                        }}
                        className="accent-amber-500" />
                      <span className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold font-mono block">{t.sku}</span>
                        <span className={`text-[10px] ${mutedCls}`}>{t.name} · {t.metalType} · {t.status}</span>
                      </span>
                      <span className="font-mono text-[10px] shrink-0">{t.netWeight.toFixed(3)} g</span>
                    </label>
                  ))}
                  {eligible.length === 0 && (
                    <p className={`p-6 text-center text-[11px] ${mutedCls}`}>
                      No pieces are in an adjustable state.
                    </p>
                  )}
                </div>
              </div>

              {selected.length > 0 && (
                <div className={`p-3 rounded-xl border text-[11px] flex justify-between ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                  <span className={mutedCls}>Writing off</span>
                  <span className="font-mono font-bold">
                    {adjustmentWeight(selected).toFixed(3)} g · {money(adjustmentValue(selected, metalRates))}
                    {def.requiresItcReversal && <span className="text-amber-500"> · ITC reversal applies</span>}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  What happened
                </label>
                <textarea value={note} rows={3}
                  placeholder="Describe the loss in at least a sentence — this is the audit trail."
                  onChange={e => { setNote(e.target.value); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                <p className={`text-[10px] ${mutedCls}`}>Authorised by {currentUserName}</p>
              </div>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={reset}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submit}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition">
                  Write Off {selectedIds.length || ''} Piece{selectedIds.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
