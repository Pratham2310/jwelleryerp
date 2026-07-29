import { useState } from 'react';
import { BadgeCheck, Plus, X, Send, PackageCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Tag, HallmarkBatch, HallmarkResult, Branch } from '../types';
import { canTransition } from '../lib/tagStateMachine';
import {
  nextBatchNumber,
  validateDispatchDraft,
  validateReceipt,
  resolveBatchStatus,
  assessPurityVariance,
  summariseBatches,
  normaliseHuid,
  BATCH_STATUS_LABEL,
} from '../lib/hallmarking';
import { purityPercentForMetal } from '../lib/fineGoldLedger';

interface HallmarkingPanelProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  batches: HallmarkBatch[];
  setBatches: React.Dispatch<React.SetStateAction<HallmarkBatch[]>>;
  activeBranch: Branch | null;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
  AtAHC: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
  Received: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  PartiallyReceived: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
};

export default function HallmarkingPanel({
  tags, setTags, batches, setBatches, activeBranch,
}: HallmarkingPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isDispatchOpen, setDispatchOpen] = useState(false);
  const [ahcName, setAhcName] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dispatchError, setDispatchError] = useState('');

  const [receivingBatch, setReceivingBatch] = useState<HallmarkBatch | null>(null);
  const [draftResults, setDraftResults] = useState<Record<string, HallmarkResult>>({});
  const [certificateRef, setCertificateRef] = useState('');
  const [receiveError, setReceiveError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseBatches(batches, tags);
  const dispatchable = tags.filter(t => t.status === 'PendingHallmark' && !t.huid);
  const tagById = (id: string) => tags.find(t => t.id === id);

  const handleDispatch = () => {
    const error = validateDispatchDraft({ ahcName, tagIds: selectedTagIds }, tags);
    if (error) { setDispatchError(error); return; }

    setBatches(prev => [{
      id: `hb-${Date.now()}`,
      batchNo: nextBatchNumber(prev),
      ahcName: ahcName.trim(),
      tagIds: [...selectedTagIds],
      status: 'AtAHC',
      dispatchedOn: new Date().toISOString().slice(0, 10),
      branchId: activeBranch?.id,
    }, ...prev]);

    setDispatchOpen(false);
    setAhcName('');
    setSelectedTagIds([]);
    setDispatchError('');
  };

  const openReceive = (b: HallmarkBatch) => {
    setReceivingBatch(b);
    // Default every piece to PASSED — the common case — so the operator only marks exceptions.
    setDraftResults(Object.fromEntries(b.tagIds.map(id => [id, {
      tagId: id,
      outcome: 'PASSED' as const,
      huid: '',
      certifiedPurityPercent: purityPercentForMetal(tagById(id)?.metalType || ''),
    }])));
    setCertificateRef('');
    setReceiveError('');
  };

  const handleReceive = () => {
    if (!receivingBatch) return;
    const results = Object.values(draftResults).map(r => ({
      ...r,
      huid: r.outcome === 'PASSED' ? normaliseHuid(r.huid || '') : undefined,
    }));

    const error = validateReceipt({ results, tags });
    if (error) { setReceiveError(error); return; }

    setBatches(prev => prev.map(b => b.id === receivingBatch.id ? {
      ...b,
      status: resolveBatchStatus(results),
      receivedOn: new Date().toISOString().slice(0, 10),
      certificateRef: certificateRef.trim() || undefined,
      results,
    } : b));

    // A pass carries the HUID and moves to Hallmarked; a failure goes back into the shop for
    // rework rather than being melted (PRD §11.3). Both go through the state machine.
    setTags(prev => prev.map(t => {
      const result = results.find(r => r.tagId === t.id);
      if (!result) return t;

      if (result.outcome === 'PASSED') {
        return canTransition(t.status, 'Hallmarked')
          ? { ...t, status: 'Hallmarked' as const, huid: result.huid }
          : t;
      }
      return canTransition(t.status, 'ReceivedFromKarigar')
        ? { ...t, status: 'ReceivedFromKarigar' as const }
        : t;
    }));

    setReceivingBatch(null);
    setDraftResults({});
    setReceiveError('');
  };

  const setResult = (tagId: string, patch: Partial<HallmarkResult>) =>
    setDraftResults(prev => ({ ...prev, [tagId]: { ...prev[tagId], ...patch } }));

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-amber-500" /> BIS Hallmarking & HUID
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              A HUID is unique to one physical piece and can never be reused (PRD §11.1). A failed
              assay returns the piece for rework, not for melting.
            </p>
          </div>
          <button
            onClick={() => { setDispatchOpen(true); setDispatchError(''); }}
            disabled={dispatchable.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Dispatch to AHC
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Awaiting Dispatch', value: summary.awaitingDispatch },
            { label: 'Pieces at AHC', value: summary.piecesAtAhc, accent: summary.piecesAtAhc > 0 },
            { label: 'Failed Assay', value: summary.failedPieces, danger: summary.failedPieces > 0 },
            { label: 'Purity Shortfall', value: summary.shortfallPieces, danger: summary.shortfallPieces > 0 },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.danger ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-2xl font-black font-mono ${
                kpi.danger ? 'text-rose-500' : kpi.accent ? 'text-amber-500' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch register */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">AHC Dispatch Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Batch No.</th>
                <th className="px-4">AHC</th>
                <th className="px-4 text-center">Pieces</th>
                <th className="px-4">Dispatched</th>
                <th className="px-4">Certificate</th>
                <th className="px-4 text-center">Status</th>
                <th className="px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${mutedCls}`}>
                    No hallmarking batches yet. Pieces awaiting hallmarking appear under "Dispatch to AHC".
                  </td>
                </tr>
              ) : batches.map(b => {
                const failed = (b.results ?? []).filter(r => r.outcome === 'FAILED').length;
                return (
                  <tr key={b.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-500">{b.batchNo}</td>
                    <td className="px-4">{b.ahcName}</td>
                    <td className="px-4 text-center font-mono">
                      {b.tagIds.length}
                      {failed > 0 && <span className="ml-1 text-rose-500 font-bold">({failed} failed)</span>}
                    </td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{b.dispatchedOn}</td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{b.certificateRef || '—'}</td>
                    <td className="px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[b.status]}`}>
                        {BATCH_STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-4 text-center">
                      {b.status === 'AtAHC' ? (
                        <button
                          onClick={() => openReceive(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
                        >
                          <PackageCheck className="w-3 h-3" /> Receive
                        </button>
                      ) : (
                        <span className={`text-[10px] font-mono ${mutedCls}`}>{b.receivedOn || '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purity shortfalls — the karigar-accountability signal PRD §11.3 asks for */}
      {summary.shortfallPieces > 0 && (
        <div className={`p-4 rounded-2xl border flex gap-3 ${
          dark ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/60 border-rose-100'
        }`}>
          <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-rose-400' : 'text-rose-600'}`} />
          <div className={`text-[11px] leading-relaxed ${dark ? 'text-rose-200/90' : 'text-rose-900'} space-y-1`}>
            <p className="font-bold">
              {summary.shortfallPieces} piece(s) certified below their declared purity.
            </p>
            {batches.flatMap(b => (b.results ?? []).map(r => ({ b, r })))
              .filter(({ r }) => {
                if (r.outcome !== 'PASSED' || r.certifiedPurityPercent === undefined) return false;
                const t = tagById(r.tagId);
                return t ? assessPurityVariance(t.metalType, r.certifiedPurityPercent).severity === 'SHORTFALL' : false;
              })
              .map(({ b, r }) => {
                const t = tagById(r.tagId)!;
                const v = assessPurityVariance(t.metalType, r.certifiedPurityPercent!);
                return <p key={`${b.id}-${r.tagId}`}>{t.sku} ({b.batchNo}): {v.message}</p>;
              })}
          </div>
        </div>
      )}

      {/* Dispatch modal */}
      {isDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-500" /> Dispatch to AHC
                </h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>{dispatchable.length} piece(s) awaiting hallmarking</p>
              </div>
              <button
                onClick={() => setDispatchOpen(false)}
                aria-label="Close dispatch"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Assaying & Hallmarking Centre</span>
                <input
                  value={ahcName}
                  onChange={e => { setAhcName(e.target.value); setDispatchError(''); }}
                  placeholder="Zaveri Bazaar AHC (BIS/AHC/1234)"
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                />
              </label>

              <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Pieces to send</p>
              {dispatchable.map(t => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                    selectedTagIds.includes(t.id)
                      ? 'border-amber-500 bg-amber-500/5'
                      : dark ? 'border-zinc-800 hover:bg-zinc-900/40' : 'border-slate-150 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(t.id)}
                    onChange={e => {
                      setSelectedTagIds(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id));
                      setDispatchError('');
                    }}
                    className="accent-amber-500"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{t.sku} — {t.name}</p>
                    <p className={`text-[10px] font-mono ${mutedCls}`}>
                      {t.metalType} · {t.netWeight.toFixed(3)}g · declared {purityPercentForMetal(t.metalType)}%
                    </p>
                  </div>
                </label>
              ))}
              {dispatchable.length === 0 && (
                <p className={`text-xs text-center py-6 ${mutedCls}`}>
                  Nothing is awaiting hallmarking. Move a piece to "Pending Hallmark" first.
                </p>
              )}

              {dispatchError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {dispatchError}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button
                onClick={handleDispatch}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition"
              >
                Dispatch {selectedTagIds.length} Piece{selectedTagIds.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive modal */}
      {receivingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-emerald-500" /> Receive from AHC
                </h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {receivingBatch.batchNo} from {receivingBatch.ahcName}
                </p>
              </div>
              <button
                onClick={() => setReceivingBatch(null)}
                aria-label="Close receive"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Hallmarking Certificate Ref</span>
                <input
                  value={certificateRef}
                  onChange={e => setCertificateRef(e.target.value)}
                  placeholder="AHC/CERT/2026/0042"
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                />
              </label>

              {receivingBatch.tagIds.map(tagId => {
                const t = tagById(tagId);
                const result = draftResults[tagId];
                if (!t || !result) return null;
                const passed = result.outcome === 'PASSED';
                const variance = passed && result.certifiedPurityPercent !== undefined
                  ? assessPurityVariance(t.metalType, result.certifiedPurityPercent)
                  : null;

                return (
                  <div key={tagId} className={`p-3 rounded-xl border space-y-2 ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{t.sku} — {t.name}</p>
                        <p className={`text-[10px] font-mono ${mutedCls}`}>
                          {t.metalType} · declared {purityPercentForMetal(t.metalType)}%
                        </p>
                      </div>
                      <div className={`inline-flex rounded-lg border overflow-hidden shrink-0 ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
                        {(['PASSED', 'FAILED'] as const).map(o => (
                          <button
                            key={o}
                            onClick={() => { setResult(tagId, { outcome: o }); setReceiveError(''); }}
                            className={`px-2.5 py-1 text-[10px] font-bold transition ${
                              result.outcome === o
                                ? o === 'PASSED' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                : dark ? 'text-zinc-400 hover:bg-zinc-900' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {o === 'PASSED' ? 'Passed' : 'Failed'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {passed ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className={`text-[9px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>HUID (6 chars)</span>
                          <input
                            value={result.huid || ''}
                            onChange={e => { setResult(tagId, { huid: e.target.value.toUpperCase() }); setReceiveError(''); }}
                            maxLength={6}
                            placeholder="A1B2C3"
                            className={`w-full text-xs font-mono uppercase px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={`text-[9px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Certified Purity %</span>
                          <input
                            type="number"
                            step="0.1"
                            value={result.certifiedPurityPercent ?? ''}
                            onChange={e => { setResult(tagId, { certifiedPurityPercent: Number(e.target.value) }); setReceiveError(''); }}
                            className={`w-full text-xs font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                          />
                        </label>
                      </div>
                    ) : (
                      <input
                        value={result.failureReason || ''}
                        onChange={e => { setResult(tagId, { failureReason: e.target.value }); setReceiveError(''); }}
                        placeholder="Why did the AHC reject it? e.g. Assay returned 89.2%, below 22K"
                        className={`w-full text-xs px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                      />
                    )}

                    {variance?.message && (
                      <p className={`text-[10px] flex items-start gap-1 ${
                        variance.severity === 'SHORTFALL' ? 'text-rose-500' : mutedCls
                      }`}>
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {variance.message}
                      </p>
                    )}
                  </div>
                );
              })}

              {receiveError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {receiveError}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button
                onClick={handleReceive}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition"
              >
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
