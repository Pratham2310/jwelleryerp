import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { JournalVoucher } from '../lib/journalPosting';
import { accountName } from '../lib/journalPosting';
import {
  buildCashBook,
  buildProfitAndLoss,
  buildBalanceSheet,
  groupLines,
  CASH_BOOK_ACCOUNTS,
} from '../lib/financialStatements';

type View = 'cashbook' | 'pl' | 'balancesheet';

interface FinancialStatementsPanelProps {
  journal: JournalVoucher[];
  view: View;
}

export default function FinancialStatementsPanel({ journal, view }: FinancialStatementsPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState(today);
  const [cashAccount, setCashAccount] = useState(CASH_BOOK_ACCOUNTS[0]);

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const signed = (n: number) => `${n < 0 ? '−' : ''}${money(n)}`;

  const DateRange = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 block">
        <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>From</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className={`text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
      </label>
      <label className="space-y-1 block">
        <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>
          {view === 'balancesheet' ? 'As On' : 'To'}
        </span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className={`text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
      </label>
      {view === 'cashbook' && (
        <label className="space-y-1 block">
          <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Account</span>
          <select value={cashAccount} onChange={e => setCashAccount(e.target.value)}
            className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
            {CASH_BOOK_ACCOUNTS.map(c => <option key={c} value={c}>{accountName(c)}</option>)}
          </select>
        </label>
      )}
      <button onClick={() => { setFromDate(monthStart); setToDate(today); }}
        className={`text-[11px] font-bold px-3 py-2 rounded-lg border transition ${
          dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}>
        This month
      </button>
    </div>
  );

  /* ─────────────────────────── Cash Book ─────────────────────────── */
  if (view === 'cashbook') {
    const cb = buildCashBook(journal, cashAccount, fromDate, toDate);
    return (
      <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${cardCls}`}>
        <div>
          <p className="text-xs font-bold">Cash Book — {cb.accountName}</p>
          <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
            The opening balance carries everything posted before this window, so the book is
            continuous — one that restarts at zero each period would show a closing balance with
            nothing to do with what is actually in the drawer.
          </p>
        </div>
        {DateRange}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Opening', value: signed(cb.openingBalance) },
            { label: 'Receipts', value: money(cb.totalReceipts), accent: true },
            { label: 'Payments', value: money(cb.totalPayments), danger: cb.totalPayments > 0 },
            { label: 'Closing', value: signed(cb.closingBalance), accent: true },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.danger ? 'border-rose-500/40 bg-rose-500/5'
                : k.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.danger ? 'text-rose-500' : k.accent ? 'text-amber-500' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>

        <p className={`text-[11px] flex items-center gap-1.5 ${
          cb.reconciles ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 font-bold'
        }`}>
          {cb.reconciles ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {cb.reconciles
            ? `Reconciles: ${signed(cb.openingBalance)} opening + ${money(cb.totalReceipts)} receipts − ${money(cb.totalPayments)} payments = ${signed(cb.closingBalance)}`
            : 'Does not reconcile — the closing balance disagrees with the movements.'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-2 px-3">Date</th>
                <th className="px-3">Voucher</th>
                <th className="px-3">Narration</th>
                <th className="px-3 text-right">Receipt</th>
                <th className="px-3 text-right">Payment</th>
                <th className="px-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {cb.rows.map((r, i) => (
                <tr key={`${r.voucherNo}-${i}`} className={`border-b last:border-0 ${rowCls}`}>
                  <td className={`py-2.5 px-3 font-mono text-[10px] ${mutedCls}`}>{r.date}</td>
                  <td className="px-3 font-mono font-bold text-amber-500">{r.voucherNo}</td>
                  <td className={`px-3 text-[11px] ${mutedCls}`}>{r.narration}</td>
                  <td className="px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {r.receipt ? money(r.receipt) : '—'}
                  </td>
                  <td className="px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                    {r.payment ? money(r.payment) : '—'}
                  </td>
                  <td className="px-3 text-right font-mono font-bold">{signed(r.balance)}</td>
                </tr>
              ))}
              {cb.rows.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>No movement in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── Profit & Loss ─────────────────────────── */
  if (view === 'pl') {
    const pl = buildProfitAndLoss(journal, fromDate, toDate);
    const Section = ({ title, lines, total }: { title: string; lines: typeof pl.income; total: number }) => (
      <div className={`rounded-xl border overflow-hidden ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
        <div className={`px-4 py-2 border-b text-[10px] uppercase font-mono font-bold tracking-wider ${rowCls} ${mutedCls}`}>
          {title}
        </div>
        <table className="w-full text-left text-xs">
          <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
            {groupLines(lines).map(g => (
              <tr key={g.group} className={`border-b last:border-0 ${rowCls}`}>
                <td className="py-2.5 px-4">
                  <p className="font-bold text-[11px]">{g.group}</p>
                  {g.lines.map(l => (
                    <p key={l.code} className={`text-[10px] ${mutedCls}`}>{l.name}</p>
                  ))}
                </td>
                <td className="px-4 text-right align-top">
                  <p className="font-mono font-bold">{money(g.total)}</p>
                  {g.lines.map(l => (
                    <p key={l.code} className={`text-[10px] font-mono ${mutedCls}`}>{money(l.amount)}</p>
                  ))}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={2} className={`py-6 text-center ${mutedCls}`}>Nothing in this period.</td></tr>
            )}
          </tbody>
        </table>
        <div className={`px-4 py-2 border-t flex justify-between text-xs font-bold ${rowCls}`}>
          <span>Total {title}</span>
          <span className="font-mono">{money(total)}</span>
        </div>
      </div>
    );

    return (
      <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${cardCls}`}>
        <div>
          <p className="text-xs font-bold">Profit &amp; Loss</p>
          <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
            A period statement — only what happened inside the window. GST collected is a
            liability, not income, so it does not appear here.
          </p>
        </div>
        {DateRange}

        <div className="grid md:grid-cols-2 gap-4">
          <Section title="Income" lines={pl.income} total={pl.totalIncome} />
          <Section title="Expenses" lines={pl.expenses} total={pl.totalExpenses} />
        </div>

        <div className={`p-4 rounded-xl border text-center ${
          pl.netProfit >= 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'
        }`}>
          <p className={`text-2xl font-black font-mono ${
            pl.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
          }`}>{signed(pl.netProfit)}</p>
          <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>
            {pl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
          </p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── Balance Sheet ─────────────────────────── */
  const bs = buildBalanceSheet(journal, toDate);
  const Column = ({ title, groups, extra }: {
    title: string;
    groups: ReturnType<typeof groupLines>;
    extra?: { label: string; amount: number };
  }) => (
    <div className={`rounded-xl border overflow-hidden ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
      <div className={`px-4 py-2 border-b text-[10px] uppercase font-mono font-bold tracking-wider ${rowCls} ${mutedCls}`}>
        {title}
      </div>
      <table className="w-full text-left text-xs">
        <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
          {groups.map(g => (
            <tr key={g.group} className={`border-b last:border-0 ${rowCls}`}>
              <td className="py-2.5 px-4">
                <p className="font-bold text-[11px]">{g.group}</p>
                {g.lines.map(l => <p key={l.code} className={`text-[10px] ${mutedCls}`}>{l.name}</p>)}
              </td>
              <td className="px-4 text-right align-top">
                <p className="font-mono font-bold">{money(g.total)}</p>
                {g.lines.map(l => (
                  <p key={l.code} className={`text-[10px] font-mono ${mutedCls}`}>{money(l.amount)}</p>
                ))}
              </td>
            </tr>
          ))}
          {extra && (
            <tr className={`border-b last:border-0 ${rowCls}`}>
              <td className="py-2.5 px-4 font-bold text-[11px]">{extra.label}</td>
              <td className="px-4 text-right font-mono font-bold">{signed(extra.amount)}</td>
            </tr>
          )}
          {groups.length === 0 && !extra && (
            <tr><td colSpan={2} className={`py-6 text-center ${mutedCls}`}>Nothing yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${cardCls}`}>
      <div>
        <p className="text-xs font-bold">Balance Sheet</p>
        <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
          A position statement, cumulative to the date — it carries every rupee of profit ever
          earned, not just this period's. It balances <span className="font-bold">because</span>{' '}
          the P&amp;L result is carried in as retained earnings; omit that and it is out by exactly
          the profit.
        </p>
      </div>
      {DateRange}

      <div className="grid md:grid-cols-2 gap-4">
        <Column title="Assets" groups={groupLines(bs.assets)} />
        <Column
          title="Liabilities & Equity"
          groups={groupLines(bs.liabilities)}
          extra={{ label: 'Retained Earnings (from P&L)', amount: bs.retainedEarnings }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className={`p-3 rounded-xl border flex justify-between text-xs font-bold ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
          <span>Total Assets</span>
          <span className="font-mono">{signed(bs.totalAssets)}</span>
        </div>
        <div className={`p-3 rounded-xl border flex justify-between text-xs font-bold ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
          <span>Total Liabilities &amp; Equity</span>
          <span className="font-mono">{signed(bs.totalLiabilitiesAndEquity)}</span>
        </div>
      </div>

      <p className={`text-[11px] flex items-center gap-1.5 ${
        bs.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 font-bold'
      }`}>
        {bs.isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {bs.isBalanced
          ? 'Balanced — assets equal liabilities plus retained earnings.'
          : `Out by ${signed(bs.difference)}. Every voucher balances individually, so a difference here means an account is missing from the chart rather than a posting being wrong.`}
      </p>
    </div>
  );
}
