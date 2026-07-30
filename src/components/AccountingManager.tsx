import { useMemo, useState } from 'react';
import { BookOpen, Scale, Landmark, ListTree, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { SaleInvoice, OldGoldVoucher, SchemeInstalment, KarigarLedgerEntry, Karigar } from '../types';
import {
  CHART_OF_ACCOUNTS,
  deriveJournal,
  buildDayBook,
  buildLedgerStatement,
  buildTrialBalance,
  summariseJournal,
  reconcileDayBook,
  voucherTotal,
  isBalanced,
  accountName,
  normalBalanceOf,
} from '../lib/journalPosting';

interface AccountingManagerProps {
  invoices: SaleInvoice[];
  oldGoldVouchers: OldGoldVoucher[];
  schemeInstalments: SchemeInstalment[];
  karigarLedger: KarigarLedgerEntry[];
  karigars: Karigar[];
}

type Tab = 'daybook' | 'trial' | 'ledger' | 'chart';

export default function AccountingManager({
  invoices, oldGoldVouchers, schemeInstalments, karigarLedger, karigars,
}: AccountingManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [tab, setTab] = useState<Tab>('daybook');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledgerCode, setLedgerCode] = useState('1100');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  // The books are DERIVED from the documents, never stored — re-deriving on every render is what
  // guarantees they can't drift from the transactions they describe (PRD §10.1).
  const journal = useMemo(() => deriveJournal({
    invoices,
    oldGoldVouchers,
    schemeInstalments,
    karigarLedger,
    karigarNameById: (id) => karigars.find(k => k.id === id)?.name ?? 'Karigar',
  }), [invoices, oldGoldVouchers, schemeInstalments, karigarLedger, karigars]);

  const summary = summariseJournal(journal);
  const trial = buildTrialBalance(journal);
  const dayBook = buildDayBook(journal, day);
  const recon = reconcileDayBook(journal, day, invoices);
  const statement = buildLedgerStatement(journal, ledgerCode);

  const money = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const dayTotal = dayBook.reduce((s, e) => s + e.amount, 0);

  // Dates that actually have postings, so the Day Book opens on something rather than an empty page.
  const postedDates = useMemo(
    () => Array.from(new Set(journal.map(v => v.date))).sort().reverse(),
    [journal]
  );

  const TABS: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: 'daybook', label: 'Day Book', icon: BookOpen },
    { key: 'trial', label: 'Trial Balance', icon: Scale },
    { key: 'ledger', label: 'Ledger Statement', icon: Landmark },
    { key: 'chart', label: 'Chart of Accounts', icon: ListTree },
  ];

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-500" /> Accounting
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          Every voucher is auto-posted from a business document — nothing is hand-entered, so the
          books cannot drift from the transactions (PRD §10.1).
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Vouchers Posted', value: String(summary.voucherCount) },
            { label: 'Gross Postings (Dr)', value: money(summary.totalPosted), accent: true },
            { label: 'Trial Balance', value: trial.balanced ? 'Balanced' : 'OUT OF BALANCE', danger: !trial.balanced },
            { label: 'Unbalanced Vouchers', value: String(summary.unbalancedCount), danger: summary.unbalancedCount > 0 },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.danger ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                kpi.danger ? 'text-rose-500' : kpi.accent ? 'text-amber-500' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* A failed Trial Balance is a bug, not a data-entry problem — say so plainly. */}
        <div className={`mt-3 flex items-start gap-2 text-[11px] ${
          trial.balanced ? (dark ? 'text-emerald-400' : 'text-emerald-700') : 'text-rose-500'
        }`}>
          {trial.balanced
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span>
            {trial.balanced
              ? `Debits and credits agree at ${money(trial.totalDebit)}.`
              : `Debits ${money(trial.totalDebit)} vs credits ${money(trial.totalCredit)} — a posting rule is wrong, not the data.`}
          </span>
        </div>
      </div>

      <div className={`flex flex-wrap gap-6 border-b pb-px ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-bold transition relative flex items-center gap-1.5 ${
              tab === t.key ? 'text-amber-500' : `${mutedCls} hover:text-slate-600 dark:hover:text-slate-300`
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'daybook' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${rowCls}`}>
            <p className="text-xs font-bold">Day Book</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={day}
                onChange={e => setDay(e.target.value)}
                className={`text-xs font-mono px-2.5 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
              />
              {postedDates.length > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && setDay(e.target.value)}
                  className={`text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                >
                  <option value="">Jump to a posted date…</option>
                  {postedDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <th className="py-3 px-4">Voucher</th>
                  <th className="px-4">Type</th>
                  <th className="px-4">Narration</th>
                  <th className="px-4">Postings</th>
                  <th className="px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                {dayBook.map(({ voucher, amount }) => (
                  <tr key={voucher.id} className={`border-b last:border-0 align-top ${rowCls}`}>
                    <td className="py-3 px-4 font-mono font-bold text-amber-500 whitespace-nowrap">{voucher.voucherNo}</td>
                    <td className={`px-4 text-[10px] font-mono ${mutedCls}`}>{voucher.type}</td>
                    <td className="px-4 text-[11px]">{voucher.narration}</td>
                    <td className="px-4">
                      {voucher.lines.map((l, i) => (
                        <p key={i} className="text-[10px] font-mono whitespace-nowrap">
                          {l.debit > 0 ? 'Dr' : '   Cr'} {accountName(l.accountCode)} — {money(l.debit || l.credit)}
                        </p>
                      ))}
                    </td>
                    <td className="px-4 text-right font-mono font-bold whitespace-nowrap">
                      {money(amount)}
                      {!isBalanced(voucher) && <span className="block text-[9px] text-rose-500">unbalanced</span>}
                    </td>
                  </tr>
                ))}
                {dayBook.length === 0 && (
                  <tr><td colSpan={5} className={`py-10 text-center ${mutedCls}`}>
                    No vouchers posted on {day}.
                    {postedDates.length > 0 && ` Most recent activity: ${postedDates[0]}.`}
                  </td></tr>
                )}
              </tbody>
              {dayBook.length > 0 && (
                <tfoot>
                  <tr className={`border-t font-bold ${rowCls}`}>
                    <td className="py-3 px-4" colSpan={4}>Gross postings for {day}</td>
                    <td className="px-4 text-right font-mono">{money(dayTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Milestone 28's acceptance criterion, made visible. Gross postings are NOT the day's
              sales value — a discounted sale debits Discount Given and reduces the cash debit by
              the same amount — so what actually reconciles is stated rather than left to be
              rediscovered by an owner comparing two figures that were never meant to match. */}
          {dayBook.length > 0 && (
            <div className={`px-5 py-3 border-t text-[11px] space-y-1 ${rowCls}`}>
              <div className="flex justify-between">
                <span className={mutedCls}>Income credited on {day}</span>
                <span className="font-mono font-bold">{money(recon.salesCredited)}</span>
              </div>
              <div className="flex justify-between">
                <span className={mutedCls}>Gross value of documents raised on {day}</span>
                <span className="font-mono font-bold">{money(recon.invoicedGross)}</span>
              </div>
              <div className={`flex items-start gap-1.5 pt-1 ${
                recon.reconciles ? (dark ? 'text-emerald-400' : 'text-emerald-700') : 'text-rose-500'
              }`}>
                {recon.reconciles
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                  : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                <span>
                  {recon.reconciles
                    ? 'Day Book reconciles against the day’s invoices.'
                    : 'Day Book does not reconcile — a posting rule is wrong.'}
                  {recon.discountPosted !== 0 && (
                    <> Gross postings read {money(recon.discountPosted)} above the invoice totals because
                    the {money(recon.discountPosted)} discount is debited to Discount Given.</>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'trial' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Trial Balance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="px-4">Account</th>
                  <th className="px-4">Group</th>
                  <th className="px-4 text-right">Debit</th>
                  <th className="px-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                {trial.rows.map(r => (
                  <tr key={r.account.code} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-2.5 px-4 font-mono">{r.account.code}</td>
                    <td className="px-4 font-bold">{r.account.name}</td>
                    <td className={`px-4 text-[10px] ${mutedCls}`}>{r.account.group}</td>
                    <td className="px-4 text-right font-mono">{r.debit ? money(r.debit) : '—'}</td>
                    <td className="px-4 text-right font-mono">{r.credit ? money(r.credit) : '—'}</td>
                  </tr>
                ))}
                {trial.rows.length === 0 && (
                  <tr><td colSpan={5} className={`py-10 text-center ${mutedCls}`}>Nothing posted yet.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 font-black ${dark ? 'border-zinc-700' : 'border-slate-300'}`}>
                  <td className="py-3 px-4" colSpan={3}>Total</td>
                  <td className="px-4 text-right font-mono">{money(trial.totalDebit)}</td>
                  <td className="px-4 text-right font-mono">{money(trial.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${rowCls}`}>
            <p className="text-xs font-bold">Ledger Statement</p>
            <select
              value={ledgerCode}
              onChange={e => setLedgerCode(e.target.value)}
              className={`text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            >
              {CHART_OF_ACCOUNTS.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="px-4">Voucher</th>
                  <th className="px-4">Narration</th>
                  <th className="px-4 text-right">Debit</th>
                  <th className="px-4 text-right">Credit</th>
                  <th className="px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                {statement.map((r, i) => (
                  <tr key={`${r.voucherNo}-${i}`} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-2.5 px-4 font-mono text-[10px] whitespace-nowrap">{r.date}</td>
                    <td className="px-4 font-mono text-[10px] whitespace-nowrap">{r.voucherNo}</td>
                    <td className="px-4 text-[11px]">{r.narration}</td>
                    <td className="px-4 text-right font-mono">{r.debit ? money(r.debit) : '—'}</td>
                    <td className="px-4 text-right font-mono">{r.credit ? money(r.credit) : '—'}</td>
                    <td className="px-4 text-right font-mono font-bold whitespace-nowrap">
                      {r.runningBalance < 0 ? `(${money(r.runningBalance)})` : money(r.runningBalance)}
                    </td>
                  </tr>
                ))}
                {statement.length === 0 && (
                  <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>
                    No movement on {accountName(ledgerCode)}.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={`px-5 py-2.5 border-t text-[10px] ${rowCls} ${mutedCls}`}>
            Balance shown in the account's natural direction ({normalBalanceOf(
              CHART_OF_ACCOUNTS.find(a => a.code === ledgerCode)?.type ?? 'ASSET'
            ).toLowerCase()}); a figure in brackets is a balance on the opposite side.
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Chart of Accounts</p>
            <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
              The minimum ledger set PRD §10.2 requires. Karigar <em>metal</em> payable is
              deliberately absent — it is grams, and decision D-2 keeps weight out of the money books.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="px-4">Account</th>
                  <th className="px-4">Type</th>
                  <th className="px-4">Group</th>
                  <th className="px-4">Increases On</th>
                </tr>
              </thead>
              <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                {CHART_OF_ACCOUNTS.map(a => (
                  <tr key={a.code} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-2.5 px-4 font-mono">{a.code}</td>
                    <td className="px-4 font-bold">{a.name}</td>
                    <td className={`px-4 text-[10px] font-mono ${mutedCls}`}>{a.type}</td>
                    <td className={`px-4 text-[10px] ${mutedCls}`}>{a.group}</td>
                    <td className="px-4 text-[10px] font-mono">{normalBalanceOf(a.type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
