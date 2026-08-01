import { useState } from 'react';
import { Plus, X, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ManualVoucher, ManualVoucherType, Branch } from '../types';
import { CHART_OF_ACCOUNTS, accountName } from '../lib/journalPosting';
import {
  validateManualVoucher,
  nextVoucherNumber,
  voucherLegs,
  summariseManualVouchers,
  selectableAgainstAccounts,
  touchesProfitAndLoss,
  CASH_AND_BANK,
  VOUCHER_TYPE_LABEL,
} from '../lib/manualVoucher';

interface ManualVoucherPanelProps {
  vouchers: ManualVoucher[];
  setVouchers: React.Dispatch<React.SetStateAction<ManualVoucher[]>>;
  activeBranch: Branch | null;
}

const TYPE_BADGE: Record<ManualVoucherType, string> = {
  PAYMENT: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
  RECEIPT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  CONTRA: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
};

export default function ManualVoucherPanel({ vouchers, setVouchers, activeBranch }: ManualVoucherPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isOpen, setOpen] = useState(false);
  const [type, setType] = useState<ManualVoucherType>('PAYMENT');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [moneyAccount, setMoneyAccount] = useState(CASH_AND_BANK[0]);
  const [againstAccount, setAgainstAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseManualVouchers(vouchers);
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const againstOptions = selectableAgainstAccounts(type, CHART_OF_ACCOUNTS);

  const reset = () => {
    setType('PAYMENT'); setDate(new Date().toISOString().slice(0, 10));
    setMoneyAccount(CASH_AND_BANK[0]); setAgainstAccount(''); setAmount('');
    setNarration(''); setError('');
  };

  const changeType = (next: ManualVoucherType) => {
    setType(next);
    // The permitted "against" accounts differ per type, so a carried-over choice may now be
    // illegal — clear it rather than let the operator submit something the validator will reject.
    setAgainstAccount('');
    setError('');
  };

  const handleSave = () => {
    const draft = {
      type, date, moneyAccount, againstAccount,
      amount: Number(amount), narration, branchId: activeBranch?.id,
    };
    const err = validateManualVoucher(draft);
    if (err) { setError(err); return; }

    setVouchers(prev => [{
      ...draft,
      id: `mv-${Date.now()}`,
      voucherNo: nextVoucherNumber(type, prev, date),
      amount: Number(amount),
      narration: narration.trim(),
    } as ManualVoucher, ...prev]);
    reset();
    setOpen(false);
  };

  const preview = againstAccount
    ? voucherLegs({ type, moneyAccount, againstAccount })
    : null;

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold">Payment, Receipt & Contra Vouchers</p>
            <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
              For money that moves without a business document behind it. A Contra is cash↔bank
              only — depositing takings does not make the shop richer, so it can never touch
              income or expense.
            </p>
          </div>
          <button onClick={() => { reset(); setOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Voucher
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Vouchers', value: String(summary.total) },
            { label: 'Money In', value: money(summary.moneyIn), accent: true },
            { label: 'Money Out', value: money(summary.moneyOut), danger: summary.moneyOut > 0 },
            { label: 'Transferred (Contra)', value: money(summary.transferred) },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.danger ? 'border-rose-500/40 bg-rose-500/5'
                : k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.danger ? 'text-rose-500' : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>
        {summary.contras > 0 && (
          <p className={`mt-3 text-[11px] ${mutedCls}`}>
            Contra volume is reported apart from money in and out, because a transfer is neither —
            it is the same money in a different place.
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Voucher Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Voucher</th>
                <th className="px-4">Date</th>
                <th className="px-4">Dr</th>
                <th className="px-4">Cr</th>
                <th className="px-4">Narration</th>
                <th className="px-4 text-right">Amount</th>
                <th className="px-4 text-center">P&amp;L</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {vouchers.map(v => {
                const legs = voucherLegs(v);
                const hitsPl = touchesProfitAndLoss(v);
                return (
                  <tr key={v.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-amber-500">{v.voucherNo}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[9px] font-bold border ${TYPE_BADGE[v.type]}`}>
                        {VOUCHER_TYPE_LABEL[v.type]}
                      </span>
                    </td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{v.date}</td>
                    <td className="px-4 text-[11px]">{accountName(legs.debitAccount)}</td>
                    <td className="px-4 text-[11px]">{accountName(legs.creditAccount)}</td>
                    <td className={`px-4 text-[11px] ${mutedCls}`}>{v.narration}</td>
                    <td className="px-4 text-right font-mono font-bold">{money(v.amount)}</td>
                    <td className="px-4 text-center">
                      <span className={`text-[10px] font-bold ${hitsPl ? 'text-amber-500' : mutedCls}`}>
                        {hitsPl ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {vouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${mutedCls}`}>
                    No manual vouchers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-500" /> New Voucher
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Close voucher"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className={`inline-flex rounded-lg border overflow-hidden ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
                {(['PAYMENT', 'RECEIPT', 'CONTRA'] as const).map(t => (
                  <button key={t} onClick={() => changeType(t)}
                    className={`px-3 py-1.5 text-[11px] font-bold transition ${
                      type === t
                        ? t === 'PAYMENT' ? 'bg-rose-500 text-white'
                          : t === 'RECEIPT' ? 'bg-emerald-500 text-white'
                          : 'bg-indigo-500 text-white'
                        : dark ? 'text-zinc-400 hover:bg-zinc-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}>
                    {VOUCHER_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={type === 'CONTRA' ? 'Into (cash/bank)' : 'Cash / Bank'} muted={mutedCls}>
                  <select value={moneyAccount}
                    onChange={e => { setMoneyAccount(e.target.value); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {CASH_AND_BANK.map(c => <option key={c} value={c}>{accountName(c)}</option>)}
                  </select>
                </Field>
                <Field label="Date" muted={mutedCls}>
                  <input type="date" value={date}
                    onChange={e => { setDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <Field label={type === 'CONTRA' ? 'From (cash/bank)' : 'Account'} muted={mutedCls}>
                <select value={againstAccount}
                  onChange={e => { setAgainstAccount(e.target.value); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                  <option value="">Select…</option>
                  {againstOptions.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </Field>

              <Field label="Amount (₹)" muted={mutedCls}>
                <input type="number" value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              <Field label="Narration" muted={mutedCls}>
                <input value={narration} placeholder="Daily takings deposited into bank"
                  onChange={e => { setNarration(e.target.value); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              {preview && (
                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                  <div className="flex justify-between">
                    <span className={mutedCls}>Debit</span>
                    <span className="font-mono">{accountName(preview.debitAccount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={mutedCls}>Credit</span>
                    <span className="font-mono">{accountName(preview.creditAccount)}</span>
                  </div>
                  {type === 'CONTRA' && (
                    <p className={mutedCls}>
                      A transfer, not income or expense — this leaves the P&amp;L untouched.
                    </p>
                  )}
                </div>
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
                Post Voucher
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
