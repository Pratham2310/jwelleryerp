import { useState } from 'react';
import { Send, Plus, X, AlertCircle, Info, Undo2, ShoppingBag } from 'lucide-react';
import type { Tag, MetalRate, Branch } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  MEMO_KYC_THRESHOLD_PAISA,
  canIssueFrom,
  memoStatus,
  outstandingLines,
  valueAtRisk,
  isMemoOverdue,
  daysOverdue,
  declaredValueOf,
  validateMemo,
  buildMemo,
  applyIssue,
  settleLine,
  applyReturn,
  summariseMemos,
  memoConversionRate,
  nextMemoNumber,
  type MemoVoucher,
  type MemoDraft,
} from '../lib/memoOut';
import { canTransition } from '../lib/tagStateMachine';

interface MemoPanelProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  memos: MemoVoucher[];
  setMemos: React.Dispatch<React.SetStateAction<MemoVoucher[]>>;
  metalRates: MetalRate[];
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

const emptyDraft = (issuedBy: string): MemoDraft => ({
  tagIds: [], customerName: '', customerPhone: '', dueBackDate: '', issuedBy,
});

export default function MemoPanel({
  tags, setTags, memos, setMemos, metalRates, activeBranch, currentUserName, canManage,
}: MemoPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { notify } = useNotifications();

  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState<MemoDraft>(emptyDraft(currentUserName));
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (paisa: number) => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);
  const rateFor = (metalType: string) =>
    Math.round((metalRates.find(r => r.metalType === metalType)?.ratePerGram ?? 0) * 100);

  const openMemos = memos.filter(m => memoStatus(m) !== 'Closed');
  const eligible = tags.filter(t => {
    if (!canIssueFrom(t.status)) return false;
    return !openMemos.some(m => outstandingLines(m).some(l => l.tagId === t.id));
  });
  const selected = tags.filter(t => draft.tagIds.includes(t.id));
  const selectedValue = declaredValueOf(selected, rateFor);
  const summary = summariseMemos(memos, today);

  const reset = () => { setOpen(false); setDraft(emptyDraft(currentUserName)); setError(''); };

  const submit = () => {
    const err = validateMemo(draft, tags, openMemos, selectedValue);
    if (err) { setError(err); return; }

    const memo = buildMemo(draft, tags, rateFor, nextMemoNumber(memos), today, activeBranch?.id);
    setMemos(prev => [memo, ...prev]);
    setTags(prev => applyIssue(memo, prev));
    notify({
      category: 'STOCK', severity: 'WARNING',
      title: `${memo.memoNumber} issued`,
      body: `${memo.lines.length} piece(s) worth ${money(valueAtRisk(memo))} left with ${memo.customerName}, due back ${memo.dueBackDate}.`,
      href: '#/inventory',
    });
    reset();
  };

  const settle = (memo: MemoVoucher, tagId: string, outcome: 'RETURNED' | 'SOLD') => {
    const updated = settleLine(memo, tagId, outcome, today);
    setMemos(prev => prev.map(m => (m.id === updated.id ? updated : m)));
    if (outcome === 'RETURNED') {
      setTags(prev => applyReturn(tagId, prev));
    } else {
      // Marked sold here so stock reflects reality; the tax invoice is raised on the Billing
      // screen against the same tag, which the state machine allows from MemoOut.
      setTags(prev => prev.map(t =>
        t.id === tagId && canTransition(t.status, 'Sold') ? { ...t, status: 'Sold' } : t
      ));
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-500" /> Memo / Approval
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Pieces out with a customer on approval. Still the shop's asset — just not in the shop.
            </p>
          </div>
          <button onClick={() => setOpen(true)} disabled={!canManage || eligible.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> Issue Memo
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Pieces Out', value: String(summary.piecesOut) },
            { label: 'Value at Risk', value: money(summary.valueAtRiskPaisa),
              warn: summary.valueAtRiskPaisa > 0 },
            { label: 'Overdue', value: String(summary.overdueMemos), danger: summary.overdueMemos > 0,
              note: summary.overdueValuePaisa > 0 ? money(summary.overdueValuePaisa) : undefined },
            { label: 'Conversion', value: `${memoConversionRate(memos).toFixed(1)}%`,
              note: `${summary.convertedToSale} sold` },
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
              {k.note && <p className={`text-[9px] mt-0.5 ${mutedCls}`}>{k.note}</p>}
            </div>
          ))}
        </div>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            Memo stock is <span className="font-bold">still the shop's asset</span> — it stays on
            the balance sheet and in the on-hand weight, but cannot be sold to a walk-in because it
            is not in the building. Above {money(MEMO_KYC_THRESHOLD_PAISA)} an ID reference is
            required before pieces leave.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Memo Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Memo</th>
                <th className="px-4">Customer</th>
                <th className="px-4">Pieces</th>
                <th className="px-4">Due Back</th>
                <th className="px-4 text-right">At Risk</th>
                <th className="px-4">Status</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {memos.map(m => {
                const overdue = isMemoOverdue(m, today);
                const status = memoStatus(m);
                return (
                  <tr key={m.id} className={`border-b last:border-0 ${rowCls} ${overdue ? 'bg-rose-500/5' : ''}`}>
                    <td className="py-3 px-4 font-mono font-bold text-[11px] align-top">
                      {m.memoNumber}
                      <span className={`block text-[9px] font-normal ${mutedCls}`}>{m.issuedOn}</span>
                    </td>
                    <td className="px-4 text-[11px] align-top">
                      {m.customerName}
                      <span className={`block text-[9px] font-mono ${mutedCls}`}>{m.customerPhone}</span>
                      {m.kycReference && (
                        <span className={`block text-[9px] font-mono ${mutedCls}`}>ID {m.kycReference}</span>
                      )}
                    </td>
                    <td className="px-4 align-top">
                      <div className="space-y-1">
                        {m.lines.map(l => (
                          <div key={l.tagId} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] w-20">{l.sku}</span>
                            <span className={`font-mono text-[10px] ${mutedCls}`}>{money(l.declaredValuePaisa)}</span>
                            {l.outcome === 'OUT' ? (
                              <>
                                <button onClick={() => settle(m, l.tagId, 'RETURNED')} disabled={!canManage}
                                  className="px-2 py-0.5 rounded border border-emerald-500/40 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-30">
                                  <Undo2 className="w-2.5 h-2.5 inline -mt-0.5" /> Back
                                </button>
                                <button onClick={() => settle(m, l.tagId, 'SOLD')} disabled={!canManage}
                                  className="px-2 py-0.5 rounded border border-[#C5A059]/50 text-[9px] font-bold text-[#8C6D34] dark:text-[#C5A059] hover:bg-amber-500/10 transition disabled:opacity-30">
                                  <ShoppingBag className="w-2.5 h-2.5 inline -mt-0.5" /> Sold
                                </button>
                              </>
                            ) : (
                              <span className={`text-[9px] font-bold ${
                                l.outcome === 'SOLD' ? 'text-[#8C6D34] dark:text-[#C5A059]' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {l.outcome === 'SOLD' ? 'SOLD' : 'RETURNED'} {l.settledOn}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className={`px-4 font-mono text-[10px] align-top ${overdue ? 'text-rose-500 font-bold' : mutedCls}`}>
                      {m.dueBackDate}
                      {overdue && <span className="block">{daysOverdue(m, today)}d late</span>}
                    </td>
                    <td className="px-4 text-right font-mono font-bold align-top">{money(valueAtRisk(m))}</td>
                    <td className="px-4 align-top">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                        status === 'Closed' ? 'text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
                          : overdue ? 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'text-amber-700 dark:text-amber-400 border-amber-500/30'
                      }`}>
                        {status === 'Closed' ? 'CLOSED' : status === 'PartiallySettled' ? 'PART' : 'OUT'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {memos.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>
                  No memos issued.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-lg my-8 rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">Issue Memo</h3>
              <button onClick={reset} aria-label="Close memo form"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Pieces ({draft.tagIds.length} selected · {money(selectedValue)})
                </label>
                <div className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${rowCls} ${dark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                  {eligible.map(t => (
                    <label key={t.id} className={`flex items-center gap-3 p-2.5 cursor-pointer ${
                      dark ? 'hover:bg-zinc-900/50' : 'hover:bg-slate-50'
                    }`}>
                      <input type="checkbox" checked={draft.tagIds.includes(t.id)}
                        onChange={() => {
                          setDraft(d => ({ ...d, tagIds: d.tagIds.includes(t.id)
                            ? d.tagIds.filter(x => x !== t.id) : [...d.tagIds, t.id] }));
                          setError('');
                        }}
                        className="accent-amber-500" />
                      <span className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold font-mono block">{t.sku}</span>
                        <span className={`text-[10px] ${mutedCls}`}>{t.name} · {t.metalType}</span>
                      </span>
                      <span className="font-mono text-[10px] shrink-0">{money(declaredValueOf([t], rateFor))}</span>
                    </label>
                  ))}
                  {eligible.length === 0 && (
                    <p className={`p-6 text-center text-[11px] ${mutedCls}`}>
                      No sellable pieces available to send out.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Customer</span>
                  <input value={draft.customerName} aria-label="Memo customer name"
                    onChange={e => { setDraft({ ...draft, customerName: e.target.value }); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Phone</span>
                  <input value={draft.customerPhone} aria-label="Memo customer phone" inputMode="numeric"
                    onChange={e => { setDraft({ ...draft, customerPhone: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Due Back
                  </span>
                  <input type="date" value={draft.dueBackDate} aria-label="Due back date"
                    onChange={e => { setDraft({ ...draft, dueBackDate: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    PAN / ID {selectedValue >= MEMO_KYC_THRESHOLD_PAISA && <span className="text-amber-500">· required</span>}
                  </span>
                  <input value={draft.kycReference ?? ''} aria-label="KYC reference"
                    placeholder={selectedValue >= MEMO_KYC_THRESHOLD_PAISA ? 'Required above ₹1,00,000' : 'Optional'}
                    onChange={e => { setDraft({ ...draft, kycReference: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <p className={`text-[10px] leading-relaxed ${mutedCls}`}>
                Issued by {currentUserName}. Without a due-back date nothing is ever overdue, and a
                piece that never returns becomes shrinkage instead of an exception.
              </p>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={reset}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submit}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Issue Memo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
