import { useState } from 'react';
import { PiggyBank, Plus, X, Receipt, BookOpen, AlertTriangle, Printer, Ban } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type {
  Customer, SavingsScheme, SchemeEnrollment, SchemeInstalment, Branch, SchemeBonusType,
} from '../types';
import {
  deriveEnrollmentBalance,
  summariseSchemeLiability,
  buildPassbook,
  bonusLabel,
  maturityDate,
  canRedeem,
  redemptionBlockReason,
  computePrematureClosure,
  validateScheme,
  validateEnrollment,
  validateInstalment,
  nextEnrollmentNumber,
  nextInstalmentReceiptNumber,
  STATUS_LABEL,
  CASH_REFUND_BLOCK_NOTICE,
} from '../lib/savingsScheme';

interface SchemeManagerProps {
  customers: Customer[];
  schemes: SavingsScheme[];
  setSchemes: React.Dispatch<React.SetStateAction<SavingsScheme[]>>;
  enrollments: SchemeEnrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<SchemeEnrollment[]>>;
  instalments: SchemeInstalment[];
  setInstalments: React.Dispatch<React.SetStateAction<SchemeInstalment[]>>;
  activeBranch: Branch | null;
}

const emptyScheme = {
  schemeCode: '', name: '', tenureMonths: '11', bonusType: 'EXTRA_INSTALMENT' as SchemeBonusType,
  bonusValue: '1', installmentAmount: '5000', isFixedInstallment: true,
  prematureClosurePenaltyPercent: '10',
};

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  Matured: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
  Redeemed: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
  Closed: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700',
  Lapsed: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

export default function SchemeManager({
  customers, schemes, setSchemes, enrollments, setEnrollments, instalments, setInstalments, activeBranch,
}: SchemeManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isSchemeOpen, setSchemeOpen] = useState(false);
  const [schemeDraft, setSchemeDraft] = useState({ ...emptyScheme });
  const [schemeError, setSchemeError] = useState('');

  const [isEnrollOpen, setEnrollOpen] = useState(false);
  const [enrollDraft, setEnrollDraft] = useState({
    customerId: '', schemeId: '', startDate: new Date().toISOString().slice(0, 10), installmentAmount: '',
  });
  const [enrollError, setEnrollError] = useState('');

  const [payingFor, setPayingFor] = useState<SchemeEnrollment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [payError, setPayError] = useState('');

  const [passbookFor, setPassbookFor] = useState<SchemeEnrollment | null>(null);

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const today = new Date().toISOString().slice(0, 10);
  const liability = summariseSchemeLiability(enrollments, schemes, instalments, today);
  const schemeById = (id: string) => schemes.find(s => s.id === id) || null;
  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? 'Unknown customer';
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const handleCreateScheme = () => {
    const draft: Partial<SavingsScheme> = {
      schemeCode: schemeDraft.schemeCode.trim(),
      name: schemeDraft.name.trim(),
      tenureMonths: Number(schemeDraft.tenureMonths),
      bonusType: schemeDraft.bonusType,
      bonusValue: Number(schemeDraft.bonusValue),
      installmentAmount: Number(schemeDraft.installmentAmount),
      isFixedInstallment: schemeDraft.isFixedInstallment,
      redemptionRule: 'JEWELLERY_ONLY',
      prematureClosurePenaltyPercent: Number(schemeDraft.prematureClosurePenaltyPercent),
      isActive: true,
    };
    const error = validateScheme(draft, schemes);
    if (error) { setSchemeError(error); return; }

    setSchemes(prev => [...prev, { ...(draft as SavingsScheme), id: `sch-${Date.now()}` }]);
    setSchemeDraft({ ...emptyScheme });
    setSchemeError('');
    setSchemeOpen(false);
  };

  const handleEnroll = () => {
    const scheme = schemeById(enrollDraft.schemeId);
    const draft: Partial<SchemeEnrollment> = {
      customerId: enrollDraft.customerId,
      schemeId: enrollDraft.schemeId,
      startDate: enrollDraft.startDate,
      installmentAmount: Number(enrollDraft.installmentAmount),
    };
    const error = validateEnrollment(draft, scheme, enrollments);
    if (error) { setEnrollError(error); return; }

    setEnrollments(prev => [...prev, {
      ...(draft as SchemeEnrollment),
      id: `en-${Date.now()}`,
      enrollmentNo: nextEnrollmentNumber(prev),
      status: 'Active',
      branchId: activeBranch?.id,
    }]);
    setEnrollDraft({ customerId: '', schemeId: '', startDate: today, installmentAmount: '' });
    setEnrollError('');
    setEnrollOpen(false);
  };

  const handleReceiveInstalment = () => {
    if (!payingFor) return;
    const scheme = schemeById(payingFor.schemeId);
    if (!scheme) return;

    const balance = deriveEnrollmentBalance(payingFor, scheme, instalments, today);
    const amount = Number(payAmount);
    const error = validateInstalment(payingFor, scheme, balance, amount);
    if (error) { setPayError(error); return; }

    setInstalments(prev => [...prev, {
      id: `si-${Date.now()}`,
      enrollmentId: payingFor.id,
      installmentNo: balance.instalmentsPaid + 1,
      amount,
      paidOn: today,
      mode: payMode,
      receiptNo: nextInstalmentReceiptNumber(prev),
    }]);
    setPayingFor(null);
    setPayAmount('');
    setPayError('');
  };

  return (
    <div className="space-y-6">
      {/* Liability header — PRD §12.4 calls this out as a balance-sheet figure */}
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-amber-500" /> Gold Savings Schemes
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Balances are folded from the instalment receipts, never stored — so a disputed
              passbook can always be answered receipt by receipt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSchemeDraft({ ...emptyScheme }); setSchemeError(''); setSchemeOpen(true); }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition ${
                dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Plus className="w-4 h-4" /> New Scheme
            </button>
            <button
              onClick={() => { setEnrollError(''); setEnrollOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition"
            >
              <Plus className="w-4 h-4" /> Enrol Customer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Liability', value: money(liability.totalLiability), accent: true },
            { label: 'Active Enrollments', value: String(liability.activeEnrollments) },
            { label: 'Matured, Unredeemed', value: String(liability.maturedAwaitingRedemption) },
            { label: 'Overdue Collections', value: money(liability.overdueAmount), danger: liability.overdueEnrollments > 0 },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.danger ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-xl font-black font-mono ${
                kpi.danger ? 'text-rose-500' : kpi.accent ? 'text-amber-500' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The legal reason there is no cash-out button anywhere in this module */}
      <div className={`p-4 rounded-2xl border flex gap-3 ${
        dark ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/60 border-amber-100'
      }`}>
        <Ban className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
        <p className={`text-[11px] leading-relaxed ${dark ? 'text-amber-200/90' : 'text-amber-900'}`}>
          <span className="font-bold">No cash refund. </span>{CASH_REFUND_BLOCK_NOTICE}
        </p>
      </div>

      {/* Scheme master */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Scheme Master</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="px-4">Scheme</th>
                <th className="px-4 text-center">Tenure</th>
                <th className="px-4">Instalment</th>
                <th className="px-4">Bonus</th>
                <th className="px-4 text-center">Early-Exit Penalty</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {schemes.map(s => (
                <tr key={s.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3 px-4 font-mono font-bold text-amber-500">{s.schemeCode}</td>
                  <td className="px-4 font-bold">{s.name}</td>
                  <td className="px-4 text-center font-mono">{s.tenureMonths} mo</td>
                  <td className="px-4 font-mono">
                    {money(s.installmentAmount)}
                    <span className={`ml-1 text-[10px] ${mutedCls}`}>{s.isFixedInstallment ? 'fixed' : 'min'}</span>
                  </td>
                  <td className="px-4">{bonusLabel(s)}</td>
                  <td className="px-4 text-center font-mono">{s.prematureClosurePenaltyPercent}%</td>
                </tr>
              ))}
              {schemes.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>No schemes configured yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enrollments */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Enrollments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Enrollment</th>
                <th className="px-4">Customer</th>
                <th className="px-4">Scheme</th>
                <th className="px-4 text-center">Paid</th>
                <th className="px-4 text-right">Principal</th>
                <th className="px-4 text-right">Bonus</th>
                <th className="px-4 text-right">Balance</th>
                <th className="px-4">Matures</th>
                <th className="px-4 text-center">Status</th>
                <th className="px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {enrollments.map(e => {
                const scheme = schemeById(e.schemeId);
                if (!scheme) return null;
                const b = deriveEnrollmentBalance(e, scheme, instalments, today);
                const status = b.lapsed ? 'Lapsed' : b.isMatured && b.isFullyPaid && e.status === 'Active' ? 'Matured' : e.status;
                const blockReason = redemptionBlockReason(b, e);

                return (
                  <tr key={e.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3 px-4 font-mono font-bold text-amber-500">{e.enrollmentNo}</td>
                    <td className="px-4 font-bold">{customerName(e.customerId)}</td>
                    <td className={`px-4 text-[11px] ${mutedCls}`}>{scheme.name}</td>
                    <td className="px-4 text-center font-mono">
                      {b.instalmentsPaid}/{scheme.tenureMonths}
                      {b.instalmentsMissed > 0 && (
                        <span className="block text-[9px] font-bold text-rose-500">{b.instalmentsMissed} overdue</span>
                      )}
                    </td>
                    <td className="px-4 text-right font-mono">{money(b.principalPaid)}</td>
                    <td className={`px-4 text-right font-mono ${b.bonusAccrued > 0 ? 'text-emerald-600 dark:text-emerald-400' : mutedCls}`}>
                      {b.bonusAccrued > 0 ? money(b.bonusAccrued) : '—'}
                    </td>
                    <td className="px-4 text-right font-mono font-bold">{money(b.balance)}</td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{maturityDate(e, scheme)}</td>
                    <td className="px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[status]}`}>
                        {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
                      </span>
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {e.status === 'Active' && !b.isFullyPaid && (
                          <button
                            onClick={() => {
                              setPayingFor(e);
                              setPayAmount(String(e.installmentAmount));
                              setPayMode('Cash');
                              setPayError('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
                          >
                            <Receipt className="w-3 h-3" /> Receive
                          </button>
                        )}
                        <button
                          onClick={() => setPassbookFor(e)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold border rounded-lg transition ${
                            dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <BookOpen className="w-3 h-3" /> Passbook
                        </button>
                        {canRedeem(b, e) && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">redeemable</span>
                        )}
                        {blockReason && e.status === 'Active' && b.isMatured && (
                          <span className={`text-[9px] ${mutedCls}`} title={blockReason}>ⓘ</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {enrollments.length === 0 && (
                <tr><td colSpan={10} className={`py-10 text-center ${mutedCls}`}>No customers enrolled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New scheme */}
      {isSchemeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2"><PiggyBank className="w-4 h-4 text-amber-500" /> New Scheme</h3>
              <button onClick={() => setSchemeOpen(false)} aria-label="Close scheme"
                className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Scheme Code" {...{ mutedCls }}>
                  <input value={schemeDraft.schemeCode} placeholder="SN11"
                    onChange={e => { setSchemeDraft({ ...schemeDraft, schemeCode: e.target.value.toUpperCase() }); setSchemeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Tenure (months)" {...{ mutedCls }}>
                  <input type="number" value={schemeDraft.tenureMonths}
                    onChange={e => { setSchemeDraft({ ...schemeDraft, tenureMonths: e.target.value }); setSchemeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>
              <Field label="Scheme Name" {...{ mutedCls }}>
                <input value={schemeDraft.name} placeholder="Swarna Nidhi 11 + 1"
                  onChange={e => { setSchemeDraft({ ...schemeDraft, name: e.target.value }); setSchemeError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bonus Type" {...{ mutedCls }}>
                  <select value={schemeDraft.bonusType}
                    onChange={e => { setSchemeDraft({ ...schemeDraft, bonusType: e.target.value as SchemeBonusType }); setSchemeError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="EXTRA_INSTALMENT">Free instalment(s)</option>
                    <option value="PERCENTAGE">% of principal</option>
                    <option value="NONE">No bonus</option>
                  </select>
                </Field>
                <Field label={schemeDraft.bonusType === 'PERCENTAGE' ? 'Bonus %' : 'Free instalments'} {...{ mutedCls }}>
                  <input type="number" step="0.5" value={schemeDraft.bonusValue}
                    disabled={schemeDraft.bonusType === 'NONE'}
                    onChange={e => { setSchemeDraft({ ...schemeDraft, bonusValue: e.target.value }); setSchemeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-40 ${inputCls}`} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Instalment (₹)" {...{ mutedCls }}>
                  <input type="number" value={schemeDraft.installmentAmount}
                    onChange={e => { setSchemeDraft({ ...schemeDraft, installmentAmount: e.target.value }); setSchemeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Early-exit penalty %" {...{ mutedCls }}>
                  <input type="number" value={schemeDraft.prematureClosurePenaltyPercent}
                    onChange={e => { setSchemeDraft({ ...schemeDraft, prematureClosurePenaltyPercent: e.target.value }); setSchemeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={schemeDraft.isFixedInstallment}
                  onChange={e => setSchemeDraft({ ...schemeDraft, isFixedInstallment: e.target.checked })}
                  className="accent-amber-500" />
                <span className={`text-[11px] ${dark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Fixed instalment (unticked = the amount above is a minimum)
                </span>
              </label>
              {schemeError && <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{schemeError}</p>}
            </div>
            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleCreateScheme}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Create Scheme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrol */}
      {isEnrollOpen && (() => {
        const scheme = schemeById(enrollDraft.schemeId);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
              <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
                <h3 className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-500" /> Enrol Customer</h3>
                <button onClick={() => setEnrollOpen(false)} aria-label="Close enrolment"
                  className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <Field label="Customer" {...{ mutedCls }}>
                  <select value={enrollDraft.customerId}
                    onChange={e => { setEnrollDraft({ ...enrollDraft, customerId: e.target.value }); setEnrollError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Select customer…</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </Field>
                <Field label="Scheme" {...{ mutedCls }}>
                  <select value={enrollDraft.schemeId}
                    onChange={e => {
                      const s = schemeById(e.target.value);
                      setEnrollDraft({
                        ...enrollDraft,
                        schemeId: e.target.value,
                        installmentAmount: s ? String(s.installmentAmount) : '',
                      });
                      setEnrollError('');
                    }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Select scheme…</option>
                    {schemes.filter(s => s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.tenureMonths}mo, {bonusLabel(s)}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date" {...{ mutedCls }}>
                    <input type="date" value={enrollDraft.startDate}
                      onChange={e => { setEnrollDraft({ ...enrollDraft, startDate: e.target.value }); setEnrollError(''); }}
                      className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                  </Field>
                  <Field label={`Instalment ₹${scheme && !scheme.isFixedInstallment ? ' (min)' : ''}`} {...{ mutedCls }}>
                    <input type="number" value={enrollDraft.installmentAmount}
                      readOnly={!!scheme?.isFixedInstallment}
                      onChange={e => { setEnrollDraft({ ...enrollDraft, installmentAmount: e.target.value }); setEnrollError(''); }}
                      className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${
                        scheme?.isFixedInstallment ? 'opacity-60 cursor-not-allowed ' : ''}${inputCls}`} />
                  </Field>
                </div>
                {scheme && (
                  <p className={`text-[10px] ${mutedCls}`}>
                    Matures {maturityDate({ ...enrollDraft, id: '', enrollmentNo: '', status: 'Active', installmentAmount: 0 } as SchemeEnrollment, scheme)} · bonus {bonusLabel(scheme)} · {scheme.prematureClosurePenaltyPercent}% early-exit penalty
                  </p>
                )}
                {enrollError && <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{enrollError}</p>}
              </div>
              <div className={`p-5 border-t ${rowCls}`}>
                <button onClick={handleEnroll}
                  className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Enrol
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receive instalment */}
      {payingFor && (() => {
        const scheme = schemeById(payingFor.schemeId)!;
        const b = deriveEnrollmentBalance(payingFor, scheme, instalments, today);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
              <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2"><Receipt className="w-4 h-4 text-amber-500" /> Receive Instalment</h3>
                  <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                    {customerName(payingFor.customerId)} · instalment {b.instalmentsPaid + 1} of {scheme.tenureMonths}
                  </p>
                </div>
                <button onClick={() => setPayingFor(null)} aria-label="Close instalment"
                  className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {b.instalmentsMissed > 1 && (
                  <p className={`text-[11px] flex items-start gap-1.5 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {b.instalmentsMissed} instalments are overdue. The maturity bonus is only earned on a fully paid tenure.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₹)" {...{ mutedCls }}>
                    <input type="number" value={payAmount}
                      readOnly={scheme.isFixedInstallment}
                      onChange={e => { setPayAmount(e.target.value); setPayError(''); }}
                      className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${
                        scheme.isFixedInstallment ? 'opacity-60 cursor-not-allowed ' : ''}${inputCls}`} />
                  </Field>
                  <Field label="Mode" {...{ mutedCls }}>
                    <select value={payMode} onChange={e => setPayMode(e.target.value as 'Cash' | 'Card' | 'UPI')}
                      className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                      <option>Cash</option><option>Card</option><option>UPI</option>
                    </select>
                  </Field>
                </div>
                {payError && <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{payError}</p>}
              </div>
              <div className={`p-5 border-t ${rowCls}`}>
                <button onClick={handleReceiveInstalment}
                  className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Record Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Passbook (Milestone 27) */}
      {passbookFor && (() => {
        const scheme = schemeById(passbookFor.schemeId)!;
        const b = deriveEnrollmentBalance(passbookFor, scheme, instalments, today);
        const rows = buildPassbook(passbookFor, scheme, instalments, today);
        const closure = computePrematureClosure(scheme, passbookFor, b);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
              <div className={`flex items-center justify-between p-5 border-b print:hidden ${rowCls}`}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-500" /> Scheme Passbook</h3>
                  <p className={`text-[11px] mt-0.5 font-mono ${mutedCls}`}>{passbookFor.enrollmentNo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition">
                    <Printer className="w-3 h-3" /> Print
                  </button>
                  <button onClick={() => setPassbookFor(null)} aria-label="Close passbook"
                    className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-4" id="print-area">
                <div className="text-center border-b pb-3 space-y-0.5">
                  <h2 className="font-black text-lg tracking-wide">{scheme.name}</h2>
                  <p className={`text-xs ${mutedCls}`}>
                    {customerName(passbookFor.customerId)} · started {passbookFor.startDate} · matures {b.maturityDate}
                  </p>
                  <p className={`text-[10px] font-mono ${mutedCls}`}>
                    {b.instalmentsPaid} of {scheme.tenureMonths} paid · bonus {bonusLabel(scheme)}
                  </p>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="pr-3">Date</th>
                      <th className="pr-3">Particulars</th>
                      <th className="text-right pr-3">Amount</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                    {rows.map(r => (
                      <tr key={`${r.installmentNo}-${r.date}`} className={`border-b last:border-0 ${rowCls}`}>
                        <td className="py-2.5 pr-3 font-mono">{r.installmentNo}</td>
                        <td className="pr-3 font-mono text-[10px]">{r.date}</td>
                        <td className="pr-3 text-[11px]">{r.particulars}</td>
                        <td className="text-right pr-3 font-mono">{money(r.amount)}</td>
                        <td className="text-right font-mono font-bold">{money(r.runningBalance)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className={`py-8 text-center ${mutedCls}`}>No instalments received yet.</td></tr>
                    )}
                  </tbody>
                </table>

                <div className={`p-3 rounded-xl border text-[11px] ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                  <div className="flex justify-between font-bold">
                    <span>Redeemable balance</span>
                    <span className="font-mono">{money(b.balance)}</span>
                  </div>
                  {!b.isMatured && (
                    <p className={`mt-1 ${mutedCls}`}>
                      Closing early today would forfeit the {money(closure.forfeitedBonus)} bonus and incur a{' '}
                      {money(closure.penalty)} penalty, leaving {money(closure.payableAsJewelleryCredit)} as jewellery credit.
                    </p>
                  )}
                </div>

                <p className={`text-[10px] leading-relaxed ${mutedCls}`}>{CASH_REFUND_BLOCK_NOTICE}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Field({ label, mutedCls, children }: { label: string; mutedCls: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>{label}</span>
      {children}
    </label>
  );
}
