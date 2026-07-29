import React, { useState } from 'react';
import { Truck, Plus, X, AlertCircle, ArrowRight, PackageCheck, FileWarning } from 'lucide-react';
import type { StockTransfer, Tag, Branch, MetalRate } from '../types';
import {
  nextEWayBillNumber,
  eWayBillExpiry,
  validateEWayBillDraft,
} from '../lib/eInvoice';
import { useTheme } from '../contexts/ThemeContext';
import { canTransition } from '../lib/tagStateMachine';
import {
  nextTransferNumber,
  validateTransferDraft,
  transferValue,
  requiresEWayBill,
  resolveReceiptStatus,
  summariseTransfers,
  branchName,
  TRANSFER_STATUS_LABEL,
  DEFAULT_EWAY_THRESHOLD,
} from '../lib/stockTransfer';

interface StockTransferPanelProps {
  /** ALL tags, not the branch-scoped view — a transfer inherently spans two branches. */
  allTags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  transfers: StockTransfer[];
  setTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  branches: Branch[];
  activeBranch: Branch | null;
  metalRates: MetalRate[];
}

/** Blank e-Way Bill draft (Milestone 22, PRD §9.5). */
const emptyEwb = { transporterName: '', vehicleNumber: '', distanceKm: '' };

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
  InTransit: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Received: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  PartiallyReceived: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
  Rejected: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
};

export default function StockTransferPanel({
  allTags, setTags, transfers, setTransfers, branches, activeBranch, metalRates,
}: StockTransferPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [toBranchId, setToBranchId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [draftError, setDraftError] = useState('');

  const [receivingTransfer, setReceivingTransfer] = useState<StockTransfer | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [receiveError, setReceiveError] = useState('');

  // e-Way Bill generation (Milestone 22)
  const [ewbTransfer, setEwbTransfer] = useState<StockTransfer | null>(null);
  const [ewbDraft, setEwbDraft] = useState({ ...emptyEwb });
  const [ewbError, setEwbError] = useState('');

  const handleGenerateEwb = () => {
    if (!ewbTransfer) return;
    const draft = {
      transporterName: ewbDraft.transporterName,
      vehicleNumber: ewbDraft.vehicleNumber,
      distanceKm: Number(ewbDraft.distanceKm),
    };
    const error = validateEWayBillDraft(draft);
    if (error) {
      setEwbError(error);
      return;
    }
    const generatedOn = new Date().toISOString().slice(0, 10);
    const ebn = nextEWayBillNumber(
      transfers.map(t => t.eWayBill?.ebn).filter((n): n is string => !!n)
    );
    setTransfers(prev => prev.map(t => t.id === ewbTransfer.id ? {
      ...t,
      eWayBill: {
        ebn,
        generatedOn,
        validUntil: eWayBillExpiry(generatedOn, draft.distanceKm),
        transporterName: draft.transporterName.trim(),
        vehicleNumber: draft.vehicleNumber.replace(/[\s-]/g, '').toUpperCase(),
        distanceKm: draft.distanceKm,
        declaredValue: t.declaredValue ?? 0,
      },
    } : t));
    setEwbTransfer(null);
    setEwbDraft({ ...emptyEwb });
    setEwbError('');
  };

  const summary = summariseTransfers(transfers);
  const fromBranchId = activeBranch?.id;

  // Only pieces physically at this branch and currently sellable can be dispatched
  const dispatchable = allTags.filter(
    t => t.branchId === fromBranchId && (t.status === 'InStock' || t.status === 'InShowcase')
  );

  const draftTags = allTags.filter(t => selectedTagIds.includes(t.id));
  const draftValue = transferValue(draftTags, metalRates);
  const draftNeedsEWay = requiresEWayBill(draftValue);

  const cardCls = dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const handleDispatch = () => {
    const draft = { fromBranchId, toBranchId, tagIds: selectedTagIds };
    const err = validateTransferDraft(draft, allTags);
    if (err) { setDraftError(err); return; }

    const today = new Date().toISOString().split('T')[0];
    const value = transferValue(draftTags, metalRates);

    const transfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      transferNo: nextTransferNumber(transfers),
      fromBranchId: fromBranchId!,
      toBranchId,
      tagIds: [...selectedTagIds],
      status: 'InTransit',
      createdOn: today,
      dispatchedOn: today,
      declaredValue: value,
      eWayBillRequired: requiresEWayBill(value),
    };

    setTransfers(prev => [transfer, ...prev]);

    // Pieces move to TransferInTransit — not sellable at EITHER branch until received (D-7)
    setTags(prev => prev.map(t =>
      selectedTagIds.includes(t.id) && canTransition(t.status, 'TransferInTransit')
        ? { ...t, status: 'TransferInTransit' as const }
        : t
    ));

    setCreateOpen(false);
    setSelectedTagIds([]);
    setToBranchId('');
    setDraftError('');
  };

  const handleReceive = () => {
    const tr = receivingTransfer;
    if (!tr) return;

    const rejected = tr.tagIds.filter(id => !acceptedIds.includes(id));
    if (rejected.length > 0 && rejectionReason.trim().length < 5) {
      setReceiveError('Record why the returned piece(s) were refused — it is the audit trail for the movement.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const status = resolveReceiptStatus(acceptedIds, tr.tagIds);

    setTransfers(prev => prev.map(t => t.id === tr.id
      ? {
          ...t, status, receivedOn: today,
          acceptedTagIds: [...acceptedIds],
          rejectedTagIds: rejected,
          rejectionReason: rejected.length ? rejectionReason.trim() : undefined,
        }
      : t));

    setTags(prev => prev.map(t => {
      if (!tr.tagIds.includes(t.id)) return t;
      if (!canTransition(t.status, 'InStock')) return t;
      // Accepted pieces change hands; refused pieces go back to where they came from.
      const landsAt = acceptedIds.includes(t.id) ? tr.toBranchId : tr.fromBranchId;
      return { ...t, status: 'InStock' as const, branchId: landsAt };
    }));

    setReceivingTransfer(null);
    setAcceptedIds([]);
    setRejectionReason('');
    setReceiveError('');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" /> Inter-Branch Stock Transfer
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Pieces in transit are sellable at neither branch until received (decision D-7).
            </p>
          </div>
          <button
            onClick={() => { setCreateOpen(true); setSelectedTagIds([]); setToBranchId(''); setDraftError(''); }}
            disabled={!activeBranch}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition shrink-0"
          >
            <Plus className="w-4 h-4" /> New Transfer from {activeBranch?.branchCode || '--'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-xl font-black font-mono">{summary.total}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${mutedCls}`}>Transfers</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-amber-950/25 border-amber-900/40' : 'bg-amber-50 border-amber-100'}`}>
            <p className={`text-xl font-black font-mono ${dark ? 'text-amber-400' : 'text-amber-700'}`}>{summary.inTransit}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${mutedCls}`}>In Transit</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-100'}`}>
            <p className="text-xl font-black font-mono">{summary.piecesInTransit}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${mutedCls}`}>Pieces In Flight</p>
          </div>
        </div>
      </div>

      {/* Register */}
      <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
        <h4 className="font-bold text-sm mb-3">Transfer Register</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className={`uppercase font-mono text-[9px] border-b ${dark ? 'text-zinc-500 border-zinc-800' : 'text-slate-400 border-slate-100'}`}>
                <th className="py-3">Transfer No.</th>
                <th>Route</th>
                <th className="text-center">Pieces</th>
                <th className="text-right">Declared Value</th>
                <th className="text-center">e-Way Bill</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-zinc-800 text-zinc-200' : 'divide-slate-100 text-slate-700'}`}>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-10 text-center font-mono ${mutedCls}`}>
                    No stock has been transferred between branches yet.
                  </td>
                </tr>
              ) : transfers.map(tr => (
                <tr key={tr.id} className={dark ? 'hover:bg-zinc-900/40' : 'hover:bg-slate-50/60'}>
                  <td className="py-3.5 font-mono font-bold text-amber-500">{tr.transferNo}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      {branchName(branches, tr.fromBranchId)}
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      {branchName(branches, tr.toBranchId)}
                    </span>
                  </td>
                  <td className="text-center font-mono">{tr.tagIds.length}</td>
                  <td className="text-right font-mono">₹{(tr.declaredValue ?? 0).toLocaleString('en-IN')}</td>
                  <td className="text-center">
                    {/* Milestone 22: M20 only flagged that an e-Way Bill was needed; the document
                        is generated here. Only the dispatching branch can raise it. */}
                    {tr.eWayBill ? (
                      <span className="inline-flex flex-col items-center leading-tight">
                        <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {tr.eWayBill.ebn}
                        </span>
                        <span className={`text-[9px] ${mutedCls}`}>valid to {tr.eWayBill.validUntil}</span>
                      </span>
                    ) : tr.eWayBillRequired ? (
                      tr.fromBranchId === activeBranch?.id && tr.status !== 'Draft' ? (
                        <button
                          onClick={() => { setEwbTransfer(tr); setEwbDraft({ ...emptyEwb }); setEwbError(''); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold border border-amber-400/60 text-amber-600 dark:text-[#C5A059] hover:bg-amber-500/10 rounded-lg transition"
                        >
                          <FileWarning className="w-3 h-3" /> Generate
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <FileWarning className="w-3 h-3" /> Required
                        </span>
                      )
                    ) : (
                      <span className={`text-[10px] ${mutedCls}`}>Not required</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[tr.status]}`}>
                      {TRANSFER_STATUS_LABEL[tr.status]}
                    </span>
                  </td>
                  <td className="text-center">
                    {/* Only the DESTINATION branch may receive a consignment */}
                    {tr.status === 'InTransit' && tr.toBranchId === activeBranch?.id ? (
                      <button
                        onClick={() => {
                          setReceivingTransfer(tr);
                          setAcceptedIds([...tr.tagIds]);
                          setRejectionReason('');
                          setReceiveError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
                      >
                        <PackageCheck className="w-3 h-3" /> Receive
                      </button>
                    ) : tr.status === 'InTransit' ? (
                      <span className={`text-[10px] ${mutedCls}`}>
                        Awaiting {branchName(branches, tr.toBranchId)}
                      </span>
                    ) : (
                      <span className={`text-[10px] ${mutedCls}`}>{tr.receivedOn || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Create / Dispatch ---------- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-amber-500" /> Dispatch Stock Transfer</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>From {activeBranch?.name}</p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Close transfer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${mutedCls}`}>Destination Branch</label>
                <select
                  value={toBranchId}
                  onChange={(e) => { setToBranchId(e.target.value); setDraftError(''); }}
                  className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                >
                  <option value="">-- Choose destination --</option>
                  {branches.filter(b => b.isActive && b.id !== activeBranch?.id).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.branchCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${mutedCls}`}>
                  Pieces to Dispatch ({dispatchable.length} available)
                </label>
                {dispatchable.length === 0 ? (
                  <p className={`text-[11px] ${mutedCls}`}>No sellable stock is currently held at this branch.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dispatchable.map(t => (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 text-xs border rounded-lg px-3 py-2 cursor-pointer transition ${
                          selectedTagIds.includes(t.id)
                            ? 'border-amber-500 bg-amber-50 text-amber-900'
                            : dark ? 'border-zinc-800 hover:bg-zinc-900' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-amber-500"
                          checked={selectedTagIds.includes(t.id)}
                          onChange={(e) => {
                            setDraftError('');
                            setSelectedTagIds(prev => e.target.checked ? [...prev, t.id] : prev.filter(i => i !== t.id));
                          }}
                        />
                        <span className="flex-1">
                          <span className="font-bold block">{t.sku} — {t.name}</span>
                          <span className={dark ? 'text-zinc-500' : 'text-slate-400'}>{t.metalType} · {t.netWeight.toFixed(3)}g</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedTagIds.length > 0 && (
                <div className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                  dark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50/60'
                }`}>
                  <div className="flex justify-between">
                    <span>Declared consignment value</span>
                    <span className="font-mono font-bold">₹{draftValue.toLocaleString('en-IN')}</span>
                  </div>
                  <p className={`text-[10px] ${mutedCls}`}>
                    Metal + stones only — a branch transfer is a movement of goods, not a sale, so making
                    charge is excluded.
                  </p>
                  {draftNeedsEWay && (
                    <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5 pt-1">
                      <FileWarning className="w-3.5 h-3.5 shrink-0" />
                      Above ₹{DEFAULT_EWAY_THRESHOLD.toLocaleString('en-IN')} — an e-Way Bill is required for this movement (PRD §9.5).
                    </p>
                  )}
                </div>
              )}

              {draftError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {draftError}
                </div>
              )}
            </div>

            <div className={`p-5 border-t ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <button
                onClick={handleDispatch}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 rounded-xl transition"
              >
                Dispatch {selectedTagIds.length || ''} Piece{selectedTagIds.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Receive at destination ---------- */}
      {/* e-Way Bill generation (Milestone 22, PRD §9.5) */}
      {ewbTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  <FileWarning className="w-4 h-4 text-amber-500" /> Generate e-Way Bill
                </h3>
                <p className={`text-[11px] mt-0.5 font-mono ${mutedCls}`}>
                  {ewbTransfer.transferNo} · ₹{(ewbTransfer.declaredValue ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setEwbTransfer(null)}
                aria-label="Close e-Way Bill"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                Simulated — no NIC portal call. Validity is one day per 200 km, as the e-Way Bill
                rules provide.
              </p>
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Transporter</span>
                <input
                  value={ewbDraft.transporterName}
                  onChange={e => setEwbDraft({ ...ewbDraft, transporterName: e.target.value })}
                  placeholder="Blue Dart Secure Logistics"
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Vehicle No.</span>
                  <input
                    value={ewbDraft.vehicleNumber}
                    onChange={e => setEwbDraft({ ...ewbDraft, vehicleNumber: e.target.value })}
                    placeholder="MH12AB1234"
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Distance (km)</span>
                  <input
                    type="number"
                    value={ewbDraft.distanceKm}
                    onChange={e => setEwbDraft({ ...ewbDraft, distanceKm: e.target.value })}
                    placeholder="150"
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
              </div>
              {ewbError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {ewbError}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <button
                onClick={handleGenerateEwb}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition"
              >
                Generate e-Way Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {receivingTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><PackageCheck className="w-4 h-4 text-emerald-500" /> Receive Consignment</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {receivingTransfer.transferNo} from {branchName(branches, receivingTransfer.fromBranchId)}
                </p>
              </div>
              <button
                onClick={() => { setReceivingTransfer(null); setReceiveError(''); }}
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Close receive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className={`text-[11px] ${mutedCls}`}>
                Tick each piece that physically arrived in good order. Anything left unticked is
                returned to {branchName(branches, receivingTransfer.fromBranchId)}.
              </p>
              <div className="space-y-1.5">
                {receivingTransfer.tagIds.map(id => {
                  const t = allTags.find(x => x.id === id);
                  const accepted = acceptedIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-3 text-xs border rounded-lg px-3 py-2 cursor-pointer transition ${
                        accepted
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                          : dark ? 'border-rose-900/50 bg-rose-950/20' : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={accepted}
                        onChange={(e) => {
                          setReceiveError('');
                          setAcceptedIds(prev => e.target.checked ? [...prev, id] : prev.filter(i => i !== id));
                        }}
                      />
                      <span className="flex-1">
                        <span className="font-bold block">{t?.sku ?? id} — {t?.name ?? 'Unknown piece'}</span>
                        <span className={accepted ? '' : 'font-bold'}>{accepted ? 'Accepted' : 'Will be returned'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {acceptedIds.length < receivingTransfer.tagIds.length && (
                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${mutedCls}`}>
                    Reason for Refusal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Clasp damaged in transit"
                    className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={rejectionReason}
                    onChange={(e) => { setRejectionReason(e.target.value); setReceiveError(''); }}
                  />
                </div>
              )}

              {receiveError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {receiveError}
                </div>
              )}
            </div>

            <div className={`p-5 border-t ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <button
                onClick={handleReceive}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl transition"
              >
                Confirm Receipt ({acceptedIds.length} accepted, {receivingTransfer.tagIds.length - acceptedIds.length} returned)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
