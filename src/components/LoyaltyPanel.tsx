import { Gift, Info, Clock } from 'lucide-react';
import type { Customer } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  DEFAULT_LOYALTY_RULE,
  EXPIRY_WARNING_DAYS,
  deriveBalance,
  entriesFor,
  summariseLoyalty,
  type LoyaltyEntry,
  type LoyaltyRule,
} from '../lib/loyalty';

interface LoyaltyPanelProps {
  entries: LoyaltyEntry[];
  customers: Customer[];
  rule?: LoyaltyRule;
}

export default function LoyaltyPanel({
  entries, customers, rule = DEFAULT_LOYALTY_RULE,
}: LoyaltyPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';

  const money = (paisa: number) => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);
  const summary = summariseLoyalty(entries, rule, today);

  const members = [...new Set(entries.map(e => e.customerId))]
    .map(id => ({
      id,
      name: customers.find(c => c.id === id)?.name ?? 'Unknown customer',
      balance: deriveBalance(entriesFor(entries, id), today),
    }))
    .filter(m => m.balance.lifetimeEarned > 0)
    .sort((a, b) => b.balance.available - a.balance.available);

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-500" /> Loyalty Programme
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          {rule.pointsPerHundred} point per ₹100 of making and stone value · 1 point ={' '}
          {money(rule.pointValuePaisa)} · up to {rule.maxRedeemPercentOfBill}% of a bill ·
          expires after {rule.expiryMonths} months
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Members Holding Points', value: String(summary.membersWithPoints) },
            { label: 'Points Outstanding', value: summary.outstandingPoints.toLocaleString('en-IN') },
            { label: 'Liability', value: money(summary.liabilityPaisa),
              warn: summary.liabilityPaisa > 0, note: 'If everyone redeemed today' },
            { label: 'Expiring Soon', value: summary.expiringSoonPoints.toLocaleString('en-IN'),
              danger: summary.expiringSoonPoints > 0, note: `within ${EXPIRY_WARNING_DAYS} days` },
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
            Points earn on <span className="font-bold">making charges and stone value, never on
            metal</span> — a percentage of metal would reward customers more every time the gold
            rate rose, for the same piece. Redemption is a <span className="font-bold">tender, not
            a discount</span>: it settles the amount due and leaves the taxable value untouched,
            the same rule D-10 applies to old gold.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Member Balances</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="px-4">Tier</th>
                <th className="px-4 text-right">Lifetime</th>
                <th className="px-4 text-right">Redeemed</th>
                <th className="px-4 text-right">Expired</th>
                <th className="px-4 text-right">Available</th>
                <th className="px-4 text-right">Worth</th>
                <th className="px-4">Expiring</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {members.map(m => (
                <tr key={m.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3 px-4 text-[11px] font-bold">{m.name}</td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      m.balance.tier === 'Platinum' ? 'text-indigo-700 dark:text-indigo-400 border-indigo-500/30'
                        : m.balance.tier === 'Gold' ? 'text-[#8C6D34] dark:text-[#C5A059] border-amber-500/40'
                        : m.balance.tier === 'Silver' ? 'text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-600'
                        : `${mutedCls} border-slate-200 dark:border-zinc-700`
                    }`}>
                      {m.balance.tier}
                    </span>
                  </td>
                  <td className={`px-4 text-right font-mono ${mutedCls}`}>{m.balance.lifetimeEarned}</td>
                  <td className={`px-4 text-right font-mono ${mutedCls}`}>{m.balance.redeemed}</td>
                  <td className={`px-4 text-right font-mono ${m.balance.expired > 0 ? 'text-rose-500' : mutedCls}`}>
                    {m.balance.expired}
                  </td>
                  <td className="px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {m.balance.available}
                  </td>
                  <td className="px-4 text-right font-mono">
                    {money(m.balance.available * rule.pointValuePaisa)}
                  </td>
                  <td className="px-4 text-[10px]">
                    {m.balance.expiringSoon > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />
                        {m.balance.expiringSoon} by {m.balance.nextExpiryDate}
                      </span>
                    ) : <span className={mutedCls}>—</span>}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={8} className={`py-10 text-center ${mutedCls}`}>
                  No points earned yet. They accrue automatically on billed making and stone value.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Points Ledger</p>
          <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
            Append-only. Balances are derived from it, never stored — so they cannot drift.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="px-4">Customer</th>
                <th className="px-4">Type</th>
                <th className="px-4 text-right">Points</th>
                <th className="px-4">Invoice</th>
                <th className="px-4">Expires</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {[...entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40).map(e => (
                <tr key={e.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className={`py-3 px-4 font-mono text-[10px] ${mutedCls}`}>{e.at}</td>
                  <td className="px-4 text-[11px]">
                    {customers.find(c => c.id === e.customerId)?.name ?? e.customerId}
                  </td>
                  <td className="px-4 text-[10px] font-bold">{e.type}</td>
                  <td className={`px-4 text-right font-mono font-bold ${
                    e.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {e.points > 0 ? '+' : ''}{e.points}
                  </td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{e.invoiceNumber ?? '—'}</td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{e.expiresOn ?? '—'}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>No ledger entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
