import { useState } from 'react';
import { Percent, Plus, X, History, ShieldCheck, AlertTriangle, CalendarClock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { TaxRate } from '../types';
import {
  resolveTaxRate,
  validateTaxRate,
  supersedeTaxRate,
  HSN,
} from '../lib/taxMaster';

interface TaxMasterPanelProps {
  taxRates: TaxRate[];
  setTaxRates: React.Dispatch<React.SetStateAction<TaxRate[]>>;
}

const emptyDraft = {
  hsnCode: '',
  description: '',
  gstRatePercent: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  notificationRef: '',
};

export default function TaxMasterPanel({ taxRates, setTaxRates }: TaxMasterPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isAddOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const cardCls = dark ? 'bg-[#141416] border-[#262626]' : 'bg-white border-slate-150';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const bodyCls = dark ? 'text-zinc-300' : 'text-slate-700';
  const headCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark
    ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
    : 'bg-white border-slate-200 text-slate-900';

  // Grouped by HSN so the version history of each code reads as one story.
  const hsnCodes = [...new Set(taxRates.map(r => r.hsnCode))].sort();

  const handleAdd = () => {
    const incoming: Partial<TaxRate> = {
      hsnCode: draft.hsnCode.trim(),
      description: draft.description.trim(),
      gstRatePercent: Number(draft.gstRatePercent),
      effectiveFrom: draft.effectiveFrom,
      notificationRef: draft.notificationRef.trim() || undefined,
    };
    const validationError = validateTaxRate(incoming, taxRates);
    if (validationError) {
      setError(validationError);
      return;
    }
    setTaxRates(prev =>
      supersedeTaxRate(prev, { ...(incoming as TaxRate), id: `tax-${Date.now()}` })
    );
    setDraft({ ...emptyDraft });
    setError('');
    setAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              <Percent className="w-4 h-4 text-amber-500" />
              Tax Master — HSN & GST Rates
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Rates are append-only and effective-dated: a change supersedes the old row rather than
              overwriting it, so a reprinted invoice still resolves the rate it was billed at (PRD §9.2).
            </p>
          </div>
          <button
            onClick={() => { setDraft({ ...emptyDraft }); setError(''); setAddOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add / Supersede Rate
          </button>
        </div>
      </div>

      {/* Diamond-split caveat: this is a live open question, not a settled rule. */}
      <div className={`p-4 rounded-2xl border flex gap-3 ${
        dark ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/60 border-amber-100'
      }`}>
        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
        <p className={`text-[11px] leading-relaxed ${dark ? 'text-amber-200/90' : 'text-amber-900'}`}>
          <span className="font-bold">HSN {HSN.DIAMOND} is defined but not applied.</span> A diamond-set
          ornament is currently billed as one composite supply at the jewellery rate (HSN {HSN.JEWELLERY}),
          matching the PRD §17 worked example. Whether it should instead be split by HSN is an open
          question awaiting CA sign-off — reassigning it here would halve the tax charged on every
          diamond sale, so it must not be changed without that decision.
        </p>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`uppercase font-mono text-[9px] border-b ${headCls} ${rowCls}`}>
                <th className="py-3 px-4">HSN / SAC</th>
                <th className="px-4">Description</th>
                <th className="px-4 text-right">Rate</th>
                <th className="px-4 text-right">CGST / SGST</th>
                <th className="px-4">Effective</th>
                <th className="px-4">Notification</th>
                <th className="px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className={bodyCls}>
              {hsnCodes.map(code => {
                const inForce = resolveTaxRate(code, taxRates, today);
                const versions = taxRates
                  .filter(r => r.hsnCode === code)
                  .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

                return versions.map((r, idx) => {
                  const isCurrent = inForce?.id === r.id;
                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${rowCls}`}>
                      <td className="py-3 px-4 font-mono font-bold">
                        {idx === 0 ? (
                          <span className={dark ? 'text-amber-400' : 'text-amber-700'}>{r.hsnCode}</span>
                        ) : (
                          <span className={`flex items-center gap-1 ${mutedCls}`}>
                            <History className="w-3 h-3" /> {r.hsnCode}
                          </span>
                        )}
                        {r.isService && <span className={`ml-1 text-[9px] ${mutedCls}`}>SAC</span>}
                      </td>
                      <td className="px-4">{r.description}</td>
                      <td className="px-4 text-right font-mono font-bold">{r.gstRatePercent}%</td>
                      <td className={`px-4 text-right font-mono ${mutedCls}`}>
                        {Number((r.gstRatePercent / 2).toFixed(3))}% + {Number((r.gstRatePercent / 2).toFixed(3))}%
                      </td>
                      <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>
                        {r.effectiveFrom} → {r.effectiveTo || 'open'}
                      </td>
                      <td className={`px-4 text-[10px] ${mutedCls}`}>{r.notificationRef || '—'}</td>
                      <td className="px-4 text-center">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 dark:border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" /> In force
                          </span>
                        ) : r.effectiveFrom > today ? (
                          /* A future row is NOT superseded — it simply has not started yet.
                             Labelling it "superseded" would read as though it had been undone. */
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 dark:border-sky-500/20">
                            <CalendarClock className="w-3 h-3" /> Scheduled
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono ${mutedCls}`}>superseded</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
              {hsnCodes.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-10 text-center text-xs ${mutedCls}`}>
                    No tax rates configured. Billing will fall back to the composite 3% jewellery rate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  <Percent className="w-4 h-4 text-amber-500" /> Add / Supersede Rate
                </h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  The existing open row for this HSN is closed the day before this one takes effect.
                </p>
              </div>
              <button
                onClick={() => setAddOpen(false)}
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${headCls}`}>HSN / SAC</span>
                  <input
                    value={draft.hsnCode}
                    onChange={e => setDraft({ ...draft, hsnCode: e.target.value })}
                    placeholder="7113"
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${headCls}`}>GST Rate %</span>
                  <input
                    type="number"
                    step="0.25"
                    value={draft.gstRatePercent}
                    onChange={e => setDraft({ ...draft, gstRatePercent: e.target.value })}
                    placeholder="3"
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${headCls}`}>Description</span>
                <input
                  value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Articles of jewellery — gold, silver, platinum"
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${headCls}`}>Effective From</span>
                  <input
                    type="date"
                    value={draft.effectiveFrom}
                    onChange={e => setDraft({ ...draft, effectiveFrom: e.target.value })}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
                <label className="space-y-1">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${headCls}`}>Notification Ref</span>
                  <input
                    value={draft.notificationRef}
                    onChange={e => setDraft({ ...draft, notificationRef: e.target.value })}
                    placeholder="Notf. 1/2017-CTR"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
                  />
                </label>
              </div>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button
                onClick={handleAdd}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition"
              >
                Append Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
