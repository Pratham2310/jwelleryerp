import { useState } from 'react';
import { Truck, Plus, X, Search, AlertTriangle, ShieldCheck, Power } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Supplier } from '../types';
import {
  validateSupplier,
  nextSupplierCode,
  summariseSuppliers,
  supplierBalanceLabel,
  deriveIdentityFromGstin,
  normaliseGstin,
  SUPPLIER_TYPE_LABEL,
} from '../lib/supplier';

interface SupplierManagerProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
}

const emptyDraft = {
  name: '', supplierType: 'BULLION_DEALER' as Supplier['supplierType'], phone: '', email: '',
  address: '', gstin: '', pan: '', stateCode: '', openingBalance: '0', creditTermsDays: '30',
};

const TYPE_BADGE: Record<Supplier['supplierType'], string> = {
  BULLION_DEALER: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
  WHOLESALER: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  SERVICE: 'bg-slate-500/10 text-slate-700 dark:text-zinc-400 border-slate-500/30',
};

export default function SupplierManager({ suppliers, setSuppliers }: SupplierManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseSuppliers(suppliers);
  const money = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  const filtered = suppliers.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.supplierCode, s.gstin, s.phone, s.pan]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  const handleSave = () => {
    // The GSTIN already contains the state and PAN — fill them rather than making someone retype
    // figures that must then be cross-checked against it anyway.
    const derived = deriveIdentityFromGstin({
      gstin: normaliseGstin(draft.gstin),
      pan: draft.pan.trim().toUpperCase(),
      stateCode: draft.stateCode.trim(),
    });

    const candidate: Partial<Supplier> = {
      name: draft.name.trim(),
      supplierType: draft.supplierType,
      phone: draft.phone.trim(),
      email: draft.email.trim() || undefined,
      address: draft.address.trim() || undefined,
      gstin: derived.gstin || undefined,
      pan: derived.pan || undefined,
      stateCode: derived.stateCode || undefined,
      openingBalance: Number(draft.openingBalance) || 0,
      creditTermsDays: Number(draft.creditTermsDays),
    };

    const err = validateSupplier(candidate, suppliers);
    if (err) { setError(err); return; }

    setSuppliers(prev => [...prev, {
      ...(candidate as Supplier),
      id: `sup-${Date.now()}`,
      supplierCode: nextSupplierCode(prev),
      isActive: true,
    }]);
    setDraft({ ...emptyDraft });
    setError('');
    setOpen(false);
  };

  const toggleActive = (id: string) =>
    // Deactivate, never delete: a supplier with purchase history must stay resolvable on old
    // documents. `selectableSuppliers()` is what keeps them off new ones.
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" /> Supplier Master
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Tenant-wide, never branch-scoped (D-5) — a supplier delivering to two branches is one
              creditor. A GSTIN carries both the state code and the PAN, so those are cross-checked.
            </p>
          </div>
          <button
            onClick={() => { setDraft({ ...emptyDraft }); setError(''); setOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Active Suppliers', value: String(summary.active) },
            { label: 'GST Registered', value: String(summary.registered) },
            { label: 'Unregistered (RCM risk)', value: String(summary.unregistered), warn: summary.unregistered > 0 },
            { label: 'Total Payable', value: money(summary.totalPayable), accent: true },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.warn ? 'border-amber-500/40 bg-amber-500/5'
                : kpi.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-xl font-black font-mono ${kpi.warn || kpi.accent ? 'text-amber-500' : ''}`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {summary.unregistered > 0 && (
          <p className={`mt-3 text-[11px] flex items-start gap-1.5 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {summary.unregistered} active supplier(s) have no GSTIN. A notified purchase from an
            unregistered supplier attracts Reverse Charge — the shop pays that GST itself and then
            claims it (PRD §9.7).
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b flex items-center gap-3 ${rowCls}`}>
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedCls}`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, GSTIN, PAN or phone…"
              className={`w-full text-xs pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Type</th>
                <th className="px-4">GSTIN</th>
                <th className="px-4 text-center">Terms</th>
                <th className="px-4 text-right">Balance</th>
                <th className="px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {filtered.map(s => (
                <tr key={s.id} className={`border-b last:border-0 ${rowCls} ${s.isActive ? '' : 'opacity-50'}`}>
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-500">{s.supplierCode}</td>
                  <td className="px-4">
                    <p className="font-bold">{s.name}</p>
                    <p className={`text-[10px] font-mono ${mutedCls}`}>{s.phone}{s.email ? ` · ${s.email}` : ''}</p>
                  </td>
                  <td className="px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${TYPE_BADGE[s.supplierType]}`}>
                      {SUPPLIER_TYPE_LABEL[s.supplierType]}
                    </span>
                  </td>
                  <td className="px-4 font-mono text-[10px]">
                    {s.gstin ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> {s.gstin}
                      </span>
                    ) : (
                      <span className={dark ? 'text-amber-400' : 'text-amber-700'}>Unregistered</span>
                    )}
                  </td>
                  <td className="px-4 text-center font-mono">{s.creditTermsDays === 0 ? 'Cash' : `${s.creditTermsDays}d`}</td>
                  <td className="px-4 text-right">
                    <p className={`font-mono font-bold ${
                      s.openingBalance > 0 ? 'text-rose-600 dark:text-rose-400'
                        : s.openingBalance < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''
                    }`}>{money(s.openingBalance)}</p>
                    <p className={`text-[9px] ${mutedCls}`}>{supplierBalanceLabel(s.openingBalance)}</p>
                  </td>
                  <td className="px-4 text-center">
                    <button
                      onClick={() => toggleActive(s.id)}
                      title={s.isActive ? 'Deactivate (kept for history)' : 'Reactivate'}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition ${
                        s.isActive
                          ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
                          : 'border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <Power className="w-3 h-3" /> {s.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${mutedCls}`}>
                    {suppliers.length === 0 ? 'No suppliers yet.' : 'No supplier matches that search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" /> Add Supplier
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close supplier"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <Field label="Supplier Name" muted={mutedCls}>
                <input value={draft.name} placeholder="Zaveri Bullion & Refinery Co."
                  onChange={e => { setDraft({ ...draft, name: e.target.value }); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" muted={mutedCls}>
                  <select value={draft.supplierType}
                    onChange={e => { setDraft({ ...draft, supplierType: e.target.value as Supplier['supplierType'] }); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {Object.entries(SUPPLIER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Mobile" muted={mutedCls}>
                  <input value={draft.phone} placeholder="9820011223"
                    onChange={e => { setDraft({ ...draft, phone: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <Field label="GSTIN (fills state code and PAN automatically)" muted={mutedCls}>
                <input value={draft.gstin} placeholder="27AACCS9948H1Z1" maxLength={15}
                  onChange={e => { setDraft({ ...draft, gstin: e.target.value.toUpperCase() }); setError(''); }}
                  className={`w-full text-xs font-mono uppercase px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="PAN" muted={mutedCls}>
                  <input value={draft.pan} placeholder="from GSTIN" maxLength={10}
                    onChange={e => { setDraft({ ...draft, pan: e.target.value.toUpperCase() }); setError(''); }}
                    className={`w-full text-xs font-mono uppercase px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="State Code" muted={mutedCls}>
                  <input value={draft.stateCode} placeholder="from GSTIN" maxLength={2}
                    onChange={e => { setDraft({ ...draft, stateCode: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <Field label="Address" muted={mutedCls}>
                <input value={draft.address} placeholder="Zaveri Bazaar, Mumbai, MH - 400002"
                  onChange={e => setDraft({ ...draft, address: e.target.value })}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Opening Balance (₹)" muted={mutedCls}>
                  <input type="number" value={draft.openingBalance}
                    onChange={e => { setDraft({ ...draft, openingBalance: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Credit Terms (days)" muted={mutedCls}>
                  <input type="number" value={draft.creditTermsDays}
                    onChange={e => { setDraft({ ...draft, creditTermsDays: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>
              <p className={`text-[10px] ${mutedCls}`}>
                Positive balance = the shop owes them. Negative = an advance sits with them.
              </p>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleSave}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Save Supplier
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
