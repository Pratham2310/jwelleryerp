import React, { useState } from 'react';
import { Flame, Plus, X, AlertCircle, FileWarning } from 'lucide-react';
import type { Tag, OldGoldVoucher, Branch, MetalStandard } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { NOTIFY } from '../lib/notifications';
import {
  isMeltableTag,
  tagAsMeltInput,
  lotAsMeltInput,
  expectedFineWeight,
  inputGrossWeight,
  validateMeltBatch,
  buildMeltBatch,
  buildOutputTag,
  applyMeltToTags,
  applyMeltToLots,
  summariseMelts,
  nextBatchNumber,
  reconcilesToInput,
  MELT_LOSS_REVIEW_PERCENT,
  type MeltBatch,
  type MeltInput,
} from '../lib/melting';

interface MeltingPanelProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  oldGoldVouchers: OldGoldVoucher[];
  setOldGoldVouchers: React.Dispatch<React.SetStateAction<OldGoldVoucher[]>>;
  batches: MeltBatch[];
  setBatches: React.Dispatch<React.SetStateAction<MeltBatch[]>>;
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

export default function MeltingPanel({
  tags, setTags, oldGoldVouchers, setOldGoldVouchers, batches, setBatches,
  activeBranch, currentUserName, canManage,
}: MeltingPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { notify } = useNotifications();

  const [isOpen, setOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [lotIds, setLotIds] = useState<string[]>([]);
  const [recovered, setRecovered] = useState('');
  const [outputMetal, setOutputMetal] = useState<MetalStandard>('Gold (24K)');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const meltableTags = tags.filter(t => isMeltableTag(t, batches));
  const meltableLots = oldGoldVouchers.filter(
    v => v.status === 'InSafe' || v.status === 'SentForMelting'
  );

  const inputs: MeltInput[] = [
    ...tags.filter(t => tagIds.includes(t.id)).map(tagAsMeltInput),
    ...oldGoldVouchers.filter(v => lotIds.includes(v.id)).map(lotAsMeltInput),
  ];
  const gross = inputGrossWeight(inputs);
  const expected = expectedFineWeight(inputs);
  const actual = parseFloat(recovered) || 0;
  const loss = gross > 0 && actual > 0 ? gross - actual : 0;
  const lossPercent = gross > 0 && actual > 0 ? (loss / gross) * 100 : 0;

  const summary = summariseMelts(batches);

  const reset = () => {
    setOpen(false); setTagIds([]); setLotIds([]); setRecovered('');
    setNote(''); setError(''); setOutputMetal('Gold (24K)');
  };

  const submit = () => {
    const err = validateMeltBatch(inputs, actual, currentUserName);
    if (err) { setError(err); return; }

    const batch = buildMeltBatch(
      inputs, actual, currentUserName, nextBatchNumber(batches),
      new Date().toISOString().slice(0, 10), note, activeBranch?.id
    );
    const output = buildOutputTag(batch, outputMetal, `RAW-${batch.batchNo}`);
    batch.outputTagId = output.id;

    setBatches(prev => [batch, ...prev]);
    // Melted pieces become terminal; the recovered metal enters stock as a new raw-metal tag.
    setTags(prev => [...applyMeltToTags(batch, prev), output]);
    setOldGoldVouchers(prev => applyMeltToLots(batch, prev));
    notify(NOTIFY.meltCompleted(batch.batchNo, batch.actualFineWeight, batch.needsReview));
    reset();
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" /> Melting
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Recovers raw metal from old-gold lots and unsold or written-off pieces. Irreversible —
              every piece in a batch ceases to exist as an ornament.
            </p>
          </div>
          <button onClick={() => setOpen(true)} disabled={!canManage}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Melt Batch
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Batches', value: String(summary.batches) },
            { label: 'Metal In', value: `${summary.totalInput.toFixed(3)} g` },
            { label: 'Fine Recovered', value: `${summary.totalRecovered.toFixed(3)} g`, accent: true },
            { label: 'Average Loss', value: `${summary.averageLossPercent.toFixed(2)}%`,
              warn: summary.averageLossPercent > MELT_LOSS_REVIEW_PERCENT },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.warn ? 'border-amber-500/40 bg-amber-500/5'
                : k.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${k.warn || k.accent ? 'text-amber-500' : ''}`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>

        {summary.needingReview > 0 && (
          <p className="mt-3 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <FileWarning className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            {summary.needingReview} batch(es) lost more than {MELT_LOSS_REVIEW_PERCENT}% and are
            flagged for review — recorded, not blocked, because a bad melt is a real event.
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Melt Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Batch</th>
                <th className="px-4">Date</th>
                <th className="px-4 text-right">Inputs</th>
                <th className="px-4 text-right">Gross In</th>
                <th className="px-4 text-right">Expected Fine</th>
                <th className="px-4 text-right">Recovered</th>
                <th className="px-4 text-right">Loss</th>
                <th className="px-4">Reconciles</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {batches.map(b => (
                <tr key={b.id} className={`border-b last:border-0 ${rowCls} ${b.needsReview ? 'bg-amber-500/5' : ''}`}>
                  <td className="py-3 px-4 font-mono font-bold text-[11px]">{b.batchNo}</td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{b.date}</td>
                  <td className="px-4 text-right font-mono">{b.inputs.length}</td>
                  <td className="px-4 text-right font-mono">{b.inputGrossWeight.toFixed(3)} g</td>
                  <td className={`px-4 text-right font-mono ${mutedCls}`}>{b.expectedFineWeight.toFixed(3)} g</td>
                  <td className="px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    {b.actualFineWeight.toFixed(3)} g
                  </td>
                  <td className={`px-4 text-right font-mono ${b.needsReview ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                    {b.lossWeight.toFixed(3)} g ({b.lossPercent.toFixed(2)}%)
                  </td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      reconcilesToInput(b)
                        ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                    }`}>
                      {reconcilesToInput(b) ? 'BALANCED' : 'OUT'}
                    </span>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={8} className={`py-10 text-center ${mutedCls}`}>
                  No melt batches recorded.
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
              <h3 className="text-sm font-bold">New Melt Batch</h3>
              <button onClick={reset} aria-label="Close melt batch"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Old Gold Lots ({lotIds.length})
                  </label>
                  <div className={`max-h-40 overflow-y-auto rounded-xl border divide-y ${rowCls} ${dark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                    {meltableLots.map(v => (
                      <label key={v.id} className={`flex items-center gap-2.5 p-2.5 cursor-pointer ${dark ? 'hover:bg-zinc-900/50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={lotIds.includes(v.id)}
                          onChange={() => { setLotIds(p => p.includes(v.id) ? p.filter(x => x !== v.id) : [...p, v.id]); setError(''); }}
                          className="accent-amber-500" />
                        <span className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold font-mono block">{v.voucherNumber}</span>
                          <span className={`text-[9px] ${mutedCls}`}>
                            {v.grossWeight.toFixed(3)} g @ {v.testedPurityPercent}%
                          </span>
                        </span>
                      </label>
                    ))}
                    {meltableLots.length === 0 && (
                      <p className={`p-5 text-center text-[10px] ${mutedCls}`}>No lots in the vault.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Pieces ({tagIds.length})
                  </label>
                  <div className={`max-h-40 overflow-y-auto rounded-xl border divide-y ${rowCls} ${dark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                    {meltableTags.map(t => (
                      <label key={t.id} className={`flex items-center gap-2.5 p-2.5 cursor-pointer ${dark ? 'hover:bg-zinc-900/50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={tagIds.includes(t.id)}
                          onChange={() => { setTagIds(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id]); setError(''); }}
                          className="accent-amber-500" />
                        <span className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold font-mono block">{t.sku}</span>
                          <span className={`text-[9px] ${mutedCls}`}>
                            {t.grossWeight.toFixed(3)} g · {t.metalType}
                            {t.huid && <span className="text-amber-600 dark:text-amber-500"> · HUID dies</span>}
                          </span>
                        </span>
                      </label>
                    ))}
                    {meltableTags.length === 0 && (
                      <p className={`p-5 text-center text-[10px] ${mutedCls}`}>No meltable pieces.</p>
                    )}
                  </div>
                </div>
              </div>

              {inputs.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1 text-[11px] ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                  <div className="flex justify-between"><span className={mutedCls}>Gross into the crucible</span>
                    <span className="font-mono font-bold">{gross.toFixed(3)} g</span></div>
                  <div className="flex justify-between"><span className={mutedCls}>Fine metal the inputs contain</span>
                    <span className="font-mono">{expected.toFixed(3)} g</span></div>
                  {actual > 0 && (
                    <div className={`flex justify-between pt-1 border-t ${rowCls}`}>
                      <span className={mutedCls}>Loss (derived, never typed)</span>
                      <span className={`font-mono font-bold ${lossPercent > MELT_LOSS_REVIEW_PERCENT ? 'text-amber-500' : ''}`}>
                        {loss.toFixed(3)} g ({lossPercent.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Fine Weight Recovered (g)
                  </label>
                  <input type="number" step="0.001" value={recovered} placeholder="0.000"
                    onChange={e => { setRecovered(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </div>
                <div className="space-y-1.5">
                  <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Output Metal Standard
                  </label>
                  <select value={outputMetal} onChange={e => setOutputMetal(e.target.value as MetalStandard)}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Note</label>
                <input value={note} placeholder="Refiner, crucible, anything worth recording"
                  onChange={e => setNote(e.target.value)}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </div>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <p className={`text-[10px] leading-relaxed ${mutedCls}`}>
                The recovered metal enters stock as a new raw-metal tag with no HUID: the hallmark
                certified an ornament that no longer exists, and carrying it forward would attach a
                BIS certification to metal never assayed in this form.
              </p>

              <div className="flex gap-2">
                <button onClick={reset}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submit}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Complete Melt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
