import { useState } from 'react';
import { Undo2, Plus, X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { PurchaseInvoice, PurchaseReturn, Supplier, Tag, Branch } from '../types';
import {
  nextDebitNoteNumber,
  calculatePurchaseReturn,
  validatePurchaseReturn,
  priorReturnedValueFor,
  summarisePurchaseReturns,
  returnableInvoices,
} from '../lib/purchaseReturn';
import { canTransition } from '../lib/tagStateMachine';

interface PurchaseReturnPanelProps {
  returns: PurchaseReturn[];
  setReturns: React.Dispatch<React.SetStateAction<PurchaseReturn[]>>;
  purchaseInvoices: PurchaseInvoice[];
  suppliers: Supplier[];
  allTags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  activeBranch: Branch | null;
}

export default function PurchaseReturnPanel({
  returns, setReturns, purchaseInvoices, suppliers, allTags, setTags, activeBranch,
}: PurchaseReturnPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isOpen, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summarisePurchaseReturns(returns, purchaseInvoices);
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? 'Unknown supplier';
  const money = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  const open = returnableInvoices(purchaseInvoices, returns);
  const invoice = purchaseInvoices.find(i => i.id === invoiceId) ?? null;
  const prior = invoice ? priorReturnedValueFor(invoice.id, returns) : 0;
  const remaining = invoice ? invoice.taxableValue - prior : 0;
  const preview = invoice && Number(value) > 0
    ? calculatePurchaseReturn(invoice, Number(value), prior)
    : null;

  // Pieces still held that came from this supplier and could physically go back.
  const returnableTags = invoice
    ? allTags.filter(t => canTransition(t.status, 'ReturnedToSupplier') && t.branchId === invoice.branchId)
    : [];

  const reset = () => {
    setInvoiceId(''); setValue(''); setReason(''); setSelectedTagIds([]);
    setReturnDate(new Date().toISOString().slice(0, 10)); setError('');
  };

  const handleSave = () => {
    if (!invoice) { setError('Select the purchase invoice being returned against.'); return; }
    const draft = { purchaseInvoiceId: invoice.id, returnDate, returnedTaxableValue: Number(value), reason };
    const err = validatePurchaseReturn(draft, invoice, prior);
    if (err) { setError(err); return; }

    const totals = calculatePurchaseReturn(invoice, Number(value), prior);

    setReturns(prev => [{
      id: `dbn-${Date.now()}`,
      debitNoteNo: nextDebitNoteNumber(prev, returnDate),
      purchaseInvoiceId: invoice.id,
      supplierId: invoice.supplierId,
      returnDate,
      reason: reason.trim(),
      ...totals,
      returnedTagIds: selectedTagIds,
      branchId: invoice.branchId,
    }, ...prev]);

    // The pieces physically leave — through the state machine, to a state that says so.
    if (selectedTagIds.length > 0) {
      setTags(prev => prev.map(t => selectedTagIds.includes(t.id) && canTransition(t.status, 'ReturnedToSupplier')
        ? { ...t, status: 'ReturnedToSupplier' as const }
        : t));
    }
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Undo2 className="w-4 h-4 text-amber-500" /> Purchase Returns & Debit Notes
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Goods go back and the input credit claimed on them goes back with them. Keeping the
              ITC on returned stock would leave the shop claiming credit on goods it no longer owns.
            </p>
          </div>
          <button
            onClick={() => { reset(); setOpen(true); }}
            disabled={open.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Raise Debit Note
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Debit Notes', value: String(summary.count) },
            { label: 'Value Returned', value: money(summary.returnedValue) },
            { label: 'ITC Reversed', value: money(summary.reversedItc), warn: summary.reversedItc > 0 },
            { label: 'Net Claimable ITC', value: money(summary.netClaimableItc), accent: true },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.warn ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                kpi.warn ? 'text-rose-500' : kpi.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Debit Note Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Debit Note</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Against</th>
                <th className="px-4">Reason</th>
                <th className="px-4 text-right">Value</th>
                <th className="px-4 text-right">ITC Reversed</th>
                <th className="px-4 text-center">Pieces</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {returns.map(r => {
                const inv = purchaseInvoices.find(i => i.id === r.purchaseInvoiceId);
                return (
                  <tr key={r.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-500">{r.debitNoteNo}</td>
                    <td className="px-4 font-bold">{supplierName(r.supplierId)}</td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{inv?.internalRef || '—'}</td>
                    <td className="px-4 text-[11px]">{r.reason}</td>
                    <td className="px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      −{money(r.returnedTaxableValue)}
                    </td>
                    <td className="px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                      −{money(r.reversedTotalTax)}
                    </td>
                    <td className="px-4 text-center font-mono">{r.returnedTagIds.length || '—'}</td>
                  </tr>
                );
              })}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${mutedCls}`}>
                    No debit notes raised yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-amber-500" /> Raise Debit Note
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Close debit note"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <Field label="Against Purchase Invoice" muted={mutedCls}>
                <select value={invoiceId}
                  onChange={e => { setInvoiceId(e.target.value); setValue(''); setSelectedTagIds([]); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                  <option value="">Select…</option>
                  {open.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.internalRef} — {supplierName(i.supplierId)} — {i.supplierInvoiceNo}
                    </option>
                  ))}
                </select>
              </Field>

              {invoice && (
                <p className={`text-[11px] ${mutedCls}`}>
                  Booked {money(invoice.taxableValue)} taxable with {money(invoice.totalTax)} credit.
                  {prior > 0 && <> {money(prior)} already returned — <span className="font-bold">{money(remaining)} remains</span>.</>}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Taxable Value Returned (₹)" muted={mutedCls}>
                  <input type="number" value={value} placeholder={invoice ? String(remaining) : '0'}
                    onChange={e => { setValue(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Return Date" muted={mutedCls}>
                  <input type="date" value={returnDate}
                    onChange={e => { setReturnDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <Field label="Reason" muted={mutedCls}>
                <input value={reason} placeholder="Assayed under-karat; dealer agreed to take it back"
                  onChange={e => { setReason(e.target.value); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              {preview && (
                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                  <div className="flex justify-between">
                    <span className={mutedCls}>Value returned</span>
                    <span className="font-mono">−{money(preview.returnedTaxableValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedCls}>Input credit reversed</span>
                    <span className="font-mono">−{money(preview.reversedTotalTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Debit note total</span>
                    <span className="font-mono">−{money(preview.debitNoteTotal)}</span>
                  </div>
                  {invoice?.isReverseCharge && (
                    <p className={mutedCls}>
                      Reverse-charge purchase: the supplier was never paid the tax, so the note is
                      for the goods only. The reversal still applies to both the liability and the
                      credit, netting to zero in cash.
                    </p>
                  )}
                </div>
              )}

              {returnableTags.length > 0 && (
                <>
                  <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Pieces physically going back (optional)
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {returnableTags.slice(0, 12).map(t => (
                      <label key={t.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition ${
                          selectedTagIds.includes(t.id)
                            ? 'border-amber-500 bg-amber-500/5'
                            : dark ? 'border-zinc-800 hover:bg-zinc-900/40' : 'border-slate-150 hover:bg-slate-50'
                        }`}>
                        <input type="checkbox" checked={selectedTagIds.includes(t.id)}
                          onChange={e => setSelectedTagIds(prev =>
                            e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))}
                          className="accent-amber-500" />
                        <span className="text-[11px] font-bold">{t.sku}</span>
                        <span className={`text-[10px] font-mono ${mutedCls}`}>
                          {t.metalType} · {t.netWeight.toFixed(3)}g · {t.status}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className={`text-[10px] ${mutedCls}`}>
                    Selected pieces move to <span className="font-bold">Returned to Supplier</span> —
                    a terminal state added for this, because recording them as damaged or melted
                    would misstate both the stock ledger and the valuation.
                  </p>
                </>
              )}

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleSave}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Raise Debit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, muted, children }: { label: string; muted: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${muted}`}>{label}</span>
      {children}
    </label>
  );
}
