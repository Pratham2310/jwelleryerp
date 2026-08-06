import { useState } from 'react';
import { Landmark, X, AlertCircle, Info, IndianRupee } from 'lucide-react';
import type { SaleInvoice, Customer, Branch } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  DEFAULT_CREDIT_DAYS,
  openInvoices,
  ageingSummary,
  customerBalances,
  summariseReceivables,
  suggestFifoAllocation,
  allocatedTotal,
  validateReceipt,
  buildReceipt,
  nextReceiptNumber,
  type CustomerReceipt,
  type ReceiptAllocation,
} from '../lib/receivables';

interface ReceivablesPanelProps {
  invoices: SaleInvoice[];
  customers: Customer[];
  receipts: CustomerReceipt[];
  setReceipts: React.Dispatch<React.SetStateAction<CustomerReceipt[]>>;
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

export default function ReceivablesPanel({
  invoices, customers, receipts, setReceipts, activeBranch, currentUserName, canManage,
}: ReceivablesPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { notify } = useNotifications();

  const [collecting, setCollecting] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [allocations, setAllocations] = useState<ReceiptAllocation[]>([]);
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (paisa: number) => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);

  const open = openInvoices(invoices, receipts, today);
  const ageing = ageingSummary(open);
  const balances = customerBalances(open, customers);
  const summary = summariseReceivables(open, customers);

  const customerOpen = collecting ? open.filter(o => o.customerId === collecting) : [];
  const collectingCustomer = customers.find(c => c.id === collecting);

  const startCollect = (customerId: string) => {
    const rows = open.filter(o => o.customerId === customerId);
    const total = rows.reduce((s, r) => s + r.outstandingPaisa, 0);
    setCollecting(customerId);
    setAmount(String(Math.round(total / 100)));
    setAllocations(suggestFifoAllocation(rows, total));
    setError('');
  };

  const reallocate = (paisa: number) => {
    setAllocations(suggestFifoAllocation(customerOpen, paisa));
    setError('');
  };

  const submit = () => {
    if (!collectingCustomer) return;
    const paisa = Math.round((parseFloat(amount) || 0) * 100);
    const err = validateReceipt(paisa, allocations, customerOpen, currentUserName);
    if (err) { setError(err); return; }

    const r = buildReceipt(
      { id: collectingCustomer.id, name: collectingCustomer.name },
      paisa, mode, allocations, nextReceiptNumber(receipts), currentUserName, today, activeBranch?.id
    );
    setReceipts(prev => [r, ...prev]);
    notify({
      category: 'SALE', severity: 'INFO',
      title: `Receipt ${r.receiptNumber}`,
      body: `${money(paisa)} collected from ${r.customerName} against ${r.allocations.length} bill(s).`,
      href: '#/accounting',
    });
    setCollecting(null); setAmount(''); setAllocations([]); setError('');
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Landmark className="w-4 h-4 text-amber-500" /> Receivables
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          What customers owe on credit sales, and how long they have owed it.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Outstanding', value: money(summary.totalOutstandingPaisa),
              warn: summary.totalOutstandingPaisa > 0, note: `${summary.openInvoices} bill(s)` },
            { label: `Overdue (>${DEFAULT_CREDIT_DAYS}d)`, value: money(summary.overduePaisa),
              danger: summary.overduePaisa > 0 },
            { label: 'Customers Owing', value: String(summary.customersOwing) },
            { label: 'Over Limit', value: String(summary.overLimitCustomers),
              danger: summary.overLimitCustomers > 0, note: `avg age ${summary.averageAgeDays}d` },
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
            Ageing runs from the <span className="font-bold">invoice date</span>, not a due date.
            Ageing from the due date would show a 45-day-old bill as 15 days — flattering, and
            useless for collection. Every receipt is allocated to named bills, so "which bill did
            this settle" always has an answer.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Ageing</p>
          </div>
          <div className="p-4 space-y-2">
            {ageing.map(a => (
              <div key={a.bucket} className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] ${
                a.bucket === '90+' ? 'border-rose-500/40 bg-rose-500/5'
                  : a.bucket === '61-90' ? 'border-amber-500/30 bg-amber-500/5'
                  : dark ? 'border-zinc-800' : 'border-slate-150'
              }`}>
                <span className="font-bold">{a.label}</span>
                <span className="font-mono">
                  {money(a.outstandingPaisa)}
                  <span className={mutedCls}> · {a.invoices} · {a.sharePercent}%</span>
                </span>
              </div>
            ))}
            {ageing.length === 0 && (
              <p className={`py-8 text-center text-[11px] ${mutedCls}`}>Nothing outstanding.</p>
            )}
          </div>
        </div>

        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Collection List</p>
            <p className={`text-[10px] mt-0.5 ${mutedCls}`}>Largest owing first, with the oldest bill.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="px-4 text-right">Owing</th>
                  <th className="px-4 text-right">Oldest</th>
                  <th className="px-4 text-right">Collect</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                {balances.map(b => (
                  <tr key={b.customerId} className={`border-b last:border-0 ${rowCls} ${b.overLimit ? 'bg-rose-500/5' : ''}`}>
                    <td className="py-2.5 px-4 text-[11px]">
                      {b.customerName}
                      {b.overLimit && (
                        <span className="block text-[9px] font-bold text-rose-500">
                          over limit of {money(b.limitPaisa)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-right font-mono font-bold">{money(b.outstandingPaisa)}</td>
                    <td className={`px-4 text-right font-mono text-[10px] ${b.oldestAgeDays > 60 ? 'text-rose-500 font-bold' : mutedCls}`}>
                      {b.oldestAgeDays}d
                    </td>
                    <td className="px-4 text-right">
                      <button onClick={() => startCollect(b.customerId)} disabled={!canManage}
                        className="px-2.5 py-1 rounded-lg bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-[10px] font-bold transition disabled:opacity-30">
                        <IndianRupee className="w-3 h-3 inline -mt-0.5" /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
                {balances.length === 0 && (
                  <tr><td colSpan={4} className={`py-8 text-center ${mutedCls}`}>Nobody owes anything.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Receipts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Receipt</th>
                <th className="px-4">Date</th>
                <th className="px-4">Customer</th>
                <th className="px-4 text-right">Amount</th>
                <th className="px-4">Allocated To</th>
                <th className="px-4">By</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {receipts.map(r => (
                <tr key={r.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3 px-4 font-mono font-bold text-[11px]">{r.receiptNumber}</td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{r.date}</td>
                  <td className="px-4 text-[11px]">{r.customerName}</td>
                  <td className="px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {money(r.amountPaisa)}
                  </td>
                  <td className={`px-4 text-[10px] font-mono ${mutedCls}`}>
                    {r.allocations.map(a => (
                      <span key={a.invoiceNumber} className="block">
                        {a.invoiceNumber} · {money(a.amountPaisa)}
                      </span>
                    ))}
                  </td>
                  <td className={`px-4 text-[10px] ${mutedCls}`}>{r.receivedBy} · {r.mode}</td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>No receipts recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {collecting && collectingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-lg my-8 rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold">Receipt from {collectingCustomer.name}</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {customerOpen.length} open bill(s)
                </p>
              </div>
              <button onClick={() => setCollecting(null)} aria-label="Close receipt"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Amount (₹)</span>
                  <input type="number" value={amount} aria-label="Receipt amount"
                    onChange={e => { setAmount(e.target.value); reallocate(Math.round((parseFloat(e.target.value) || 0) * 100)); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Mode</span>
                  <select value={mode} aria-label="Receipt mode" onChange={e => setMode(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              <div className="space-y-1.5">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Allocation ({money(allocatedTotal(allocations))} of {money(Math.round((parseFloat(amount) || 0) * 100))})
                </span>
                <div className={`rounded-xl border divide-y ${rowCls} ${dark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
                  {customerOpen.map(inv => {
                    const alloc = allocations.find(a => a.invoiceNumber === inv.invoiceNumber);
                    return (
                      <div key={inv.invoiceNumber} className="flex items-center gap-3 p-2.5 text-[11px]">
                        <span className="font-mono font-bold w-28">{inv.invoiceNumber}</span>
                        <span className={`text-[10px] ${inv.ageDays > 60 ? 'text-rose-500 font-bold' : mutedCls}`}>
                          {inv.ageDays}d
                        </span>
                        <span className={`font-mono text-[10px] flex-1 ${mutedCls}`}>
                          owes {money(inv.outstandingPaisa)}
                        </span>
                        <span className={`font-mono font-bold ${alloc ? 'text-emerald-600 dark:text-emerald-400' : mutedCls}`}>
                          {alloc ? money(alloc.amountPaisa) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className={`text-[10px] ${mutedCls}`}>
                  Suggested oldest-first. The allocation stored is the one confirmed here.
                </p>
              </div>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setCollecting(null)}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submit}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Record Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
