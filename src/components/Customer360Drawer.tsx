import { X, User, TrendingUp, Receipt, PiggyBank } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Customer, SaleInvoice, SavingsScheme, SchemeEnrollment, SchemeInstalment } from '../types';
import { customerHistory, customerProfile } from '../lib/reports';
import { deriveEnrollmentBalance, bonusLabel } from '../lib/savingsScheme';
import { maskAadhaar } from '../lib/supplier';

interface Customer360DrawerProps {
  customer: Customer;
  invoices: SaleInvoice[];
  schemes: SavingsScheme[];
  enrollments: SchemeEnrollment[];
  instalments: SchemeInstalment[];
  onClose: () => void;
}

const TYPE_BADGE: Record<string, string> = {
  TAX_INVOICE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  CREDIT_NOTE: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
  ESTIMATE: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  TAX_INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit Note',
  ESTIMATE: 'Estimate',
};

export default function Customer360Drawer({
  customer, invoices, schemes, enrollments, instalments, onClose,
}: Customer360DrawerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';

  const money = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN')}`;
  const history = customerHistory(invoices, customer.name);
  const profile = customerProfile(invoices, customer.name);
  const today = new Date().toISOString().slice(0, 10);

  const mine = enrollments.filter(e => e.customerId === customer.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-end">
      <div className={`w-full max-w-xl h-full overflow-y-auto border-l shadow-2xl ${cardCls}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b ${cardCls} ${rowCls}`}>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" /> {customer.name}
            </h3>
            <p className={`text-[11px] mt-0.5 font-mono ${mutedCls}`}>
              {customer.phone}{customer.email ? ` · ${customer.email}` : ''} · {customer.tier}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close customer profile"
            className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lifetime Value', value: money(profile.lifetimeValue), accent: true,
                note: 'Net of returns; estimates excluded' },
              { label: 'Purchases', value: String(profile.purchaseCount) },
              { label: 'Average Ticket', value: money(profile.averageTicket) },
              { label: 'Returns', value: String(profile.returnCount), danger: profile.returnCount > 0 },
            ].map(k => (
              <div key={k.label} className={`p-4 rounded-xl border ${
                k.danger ? 'border-rose-500/40 bg-rose-500/5'
                  : k.accent ? 'border-amber-500/40 bg-amber-500/5'
                  : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
              }`}>
                <p className={`text-lg font-black font-mono ${
                  k.danger ? 'text-rose-500' : k.accent ? 'text-amber-500' : ''
                }`}>{k.value}</p>
                <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
                {k.note && <p className={`text-[9px] mt-0.5 ${mutedCls}`}>{k.note}</p>}
              </div>
            ))}
          </div>

          {(customer.pan || customer.gstin || customer.aadhaar) && (
            <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>KYC on file</p>
              {customer.pan && <div className="flex justify-between"><span className={mutedCls}>PAN</span><span className="font-mono">{customer.pan}</span></div>}
              {customer.gstin && <div className="flex justify-between"><span className={mutedCls}>GSTIN</span><span className="font-mono">{customer.gstin}</span></div>}
              {/* Never shown in full — UIDAI guidance. */}
              {customer.aadhaar && <div className="flex justify-between"><span className={mutedCls}>Aadhaar</span><span className="font-mono">{maskAadhaar(customer.aadhaar)}</span></div>}
            </div>
          )}

          {mine.length > 0 && (
            <div className="space-y-2">
              <p className={`text-[10px] uppercase font-mono font-bold tracking-wider flex items-center gap-1.5 ${mutedCls}`}>
                <PiggyBank className="w-3 h-3" /> Savings Schemes
              </p>
              {mine.map(e => {
                const scheme = schemes.find(s => s.id === e.schemeId);
                if (!scheme) return null;
                const b = deriveEnrollmentBalance(e, scheme, instalments, today);
                return (
                  <div key={e.id} className={`p-3 rounded-xl border text-[11px] space-y-1 ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                    <div className="flex justify-between font-bold">
                      <span>{scheme.name}</span>
                      <span className="font-mono">{money(b.balance)}</span>
                    </div>
                    <p className={mutedCls}>
                      {b.instalmentsPaid} of {scheme.tenureMonths} paid · matures {b.maturityDate} · bonus {bonusLabel(scheme)}
                      {b.instalmentsMissed > 0 && (
                        <span className="text-rose-500 font-bold"> · {b.instalmentsMissed} overdue</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <p className={`text-[10px] uppercase font-mono font-bold tracking-wider flex items-center gap-1.5 ${mutedCls}`}>
              <Receipt className="w-3 h-3" /> History
              {profile.firstPurchase && (
                <span className="font-normal normal-case tracking-normal">
                  · first {profile.firstPurchase}, last {profile.lastPurchase}
                </span>
              )}
            </p>

            {history.length === 0 && (
              <p className={`text-[11px] py-6 text-center ${mutedCls}`}>
                No documents for this customer yet.
              </p>
            )}

            {/* Newest first — the question a counter asks is "what did they just do". */}
            {history.map(h => (
              <div key={`${h.invoiceNumber}-${h.date}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold font-mono">{h.invoiceNumber}</p>
                  <p className={`text-[10px] ${mutedCls}`}>
                    {h.date} · {h.itemCount} item{h.itemCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${TYPE_BADGE[h.type]}`}>
                  {TYPE_LABEL[h.type]}
                </span>
                <span className={`font-mono text-xs font-bold shrink-0 ${
                  h.total < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                }`}>{money(h.total)}</span>
              </div>
            ))}
          </div>

          {profile.estimateCount > 0 && (
            <p className={`text-[11px] flex items-start gap-1.5 ${mutedCls}`}>
              <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {profile.estimateCount} estimate(s) shown above but excluded from lifetime value — a
              quotation is not a sale until it is converted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
