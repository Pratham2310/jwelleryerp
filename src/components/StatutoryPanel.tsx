import { useState } from 'react';
import { Scale, AlertTriangle, ShieldCheck, Info, Trash2, Plus, KeyRound } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { StatutoryParameters, ApprovalRecord } from '../types';
import {
  PARAMETER_DEFS,
  validateStatutoryParameters,
  validateSupervisor,
  summariseApprovals,
  SUPERVISOR_PIN_NOTICE,
  APPROVAL_KIND_LABEL,
  type SupervisorPin,
} from '../lib/statutoryParameters';

interface StatutoryPanelProps {
  parameters: StatutoryParameters;
  setParameters: React.Dispatch<React.SetStateAction<StatutoryParameters>>;
  approvals: ApprovalRecord[];
  supervisors: SupervisorPin[];
  setSupervisors: React.Dispatch<React.SetStateAction<SupervisorPin[]>>;
  /** Roles that hold `billing.override` — only these can be named as approvers. */
  approvingRoleNames: string[];
  canEdit: boolean;
}

export default function StatutoryPanel({
  parameters, setParameters, approvals, supervisors, setSupervisors, approvingRoleNames, canEdit,
}: StatutoryPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [draft, setDraft] = useState<StatutoryParameters>(parameters);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [newSupervisor, setNewSupervisor] = useState<SupervisorPin>({
    roleName: approvingRoleNames[0] || '', supervisorName: '', pin: '',
  });
  const [supervisorError, setSupervisorError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const summary = summariseApprovals(approvals);

  const save = () => {
    const err = validateStatutoryParameters(draft);
    if (err) { setError(err); setSaved(false); return; }
    setParameters(draft);
    setError('');
    setSaved(true);
  };

  const addSupervisor = () => {
    const err = validateSupervisor(newSupervisor, supervisors, approvingRoleNames);
    if (err) { setSupervisorError(err); return; }
    setSupervisors(prev => [...prev, { ...newSupervisor, supervisorName: newSupervisor.supervisorName.trim() }]);
    setNewSupervisor({ roleName: approvingRoleNames[0] || '', supervisorName: '', pin: '' });
    setSupervisorError('');
  };

  const removeSupervisor = (pin: string) => {
    // Removing the last one would leave nobody able to authorise an override, which stops the
    // counter rather than protecting it.
    if (supervisors.length === 1) {
      setSupervisorError('Keep at least one supervisor — with none, no override could ever be approved.');
      return;
    }
    setSupervisors(prev => prev.filter(s => s.pin !== pin));
    setSupervisorError('');
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-500" /> Statutory Parameters
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          These are policy, not arithmetic — they move by notification. Holding them in code would
          mean waiting for a release to comply with a change.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {PARAMETER_DEFS.map(def => (
            <label key={def.key} className="space-y-1 block">
              <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>
                {def.label}
              </span>
              <input
                type="number"
                step={def.unit === 'percent' ? '0.1' : '1'}
                value={String(draft[def.key] ?? '')}
                disabled={!canEdit}
                onChange={e => {
                  setDraft({ ...draft, [def.key]: Number(e.target.value) });
                  setError(''); setSaved(false);
                }}
                className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-50 ${inputCls}`}
              />
              {/* The source, so an accountant can check the figure against the statute. */}
              <span className={`text-[10px] ${mutedCls}`}>{def.authority}</span>
            </label>
          ))}

          <label className="space-y-1 block">
            <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>
              Effective From
            </span>
            <input type="date" value={draft.effectiveFrom} disabled={!canEdit}
              onChange={e => { setDraft({ ...draft, effectiveFrom: e.target.value }); setError(''); setSaved(false); }}
              className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-50 ${inputCls}`} />
          </label>
        </div>

        {error && (
          <p className="mt-3 text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Saved — the PAN gate now triggers at {money(parameters.panThreshold)} with no code change.
          </p>
        )}

        <button onClick={save} disabled={!canEdit}
          className="mt-4 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition">
          Save Parameters
        </button>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            A missing or zero threshold falls back to the statutory default rather than to zero —
            a PAN threshold of zero would demand a declaration on every sale and stop the shop
            trading, which is a worse failure than the one the check exists to prevent.
          </p>
        </div>
      </div>

      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-500" /> Supervisors
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          Only roles that can override a price may approve one — otherwise the sign-off is a
          signature, not a second pair of eyes.
        </p>

        <div className="mt-4 space-y-2">
          {supervisors.map(s => (
            <div key={s.pin} className={`flex items-center gap-3 p-3 rounded-xl border ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold">{s.supervisorName}</p>
                <p className={`text-[10px] ${mutedCls}`}>{s.roleName}</p>
              </div>
              {/* Never rendered in the clear — the log proves who approved, the PIN needn't be readable. */}
              <span className={`font-mono text-xs tracking-[0.3em] ${mutedCls}`}>••••</span>
              <button onClick={() => removeSupervisor(s.pin)} disabled={!canEdit}
                aria-label={`Remove ${s.supervisorName}`}
                className={`p-1.5 rounded-lg transition disabled:opacity-30 ${dark ? 'hover:bg-rose-500/10 text-rose-400' : 'hover:bg-rose-50 text-rose-600'}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 mt-3">
            <input
              value={newSupervisor.supervisorName}
              placeholder="Supervisor name"
              aria-label="Supervisor name"
              onChange={e => { setNewSupervisor({ ...newSupervisor, supervisorName: e.target.value }); setSupervisorError(''); }}
              className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            />
            <select
              value={newSupervisor.roleName}
              aria-label="Supervisor role"
              onChange={e => { setNewSupervisor({ ...newSupervisor, roleName: e.target.value }); setSupervisorError(''); }}
              className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            >
              {approvingRoleNames.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              value={newSupervisor.pin}
              placeholder="PIN"
              inputMode="numeric"
              maxLength={6}
              aria-label="New supervisor PIN"
              onChange={e => { setNewSupervisor({ ...newSupervisor, pin: e.target.value }); setSupervisorError(''); }}
              className={`text-xs font-mono px-3 py-2 border rounded-lg w-24 focus:outline-none focus:border-amber-500 ${inputCls}`}
            />
            <button onClick={addSupervisor}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        )}

        {supervisorError && (
          <p className="mt-3 text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 inline mr-1" />{supervisorError}
          </p>
        )}

        <p className={`text-[10px] mt-3 leading-relaxed ${mutedCls}`}>{SUPERVISOR_PIN_NOTICE}</p>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Supervisor Approval Log
          </p>
          <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
            Permissions answer "may this person do it". These answer "was it authorised this time" —
            and record a person, not a role.
          </p>
        </div>

        {summary.total > 0 && (
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b ${rowCls}`}>
            <div className={`p-3 rounded-xl border text-center ${dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'}`}>
              <p className="text-lg font-black font-mono">{summary.total}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>Approvals</p>
            </div>
            {summary.byKind.map(k => (
              <div key={k.kind} className={`p-3 rounded-xl border text-center ${dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'}`}>
                <p className="text-lg font-black font-mono">{money(k.value)}</p>
                <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>
                  {APPROVAL_KIND_LABEL[k.kind]} ({k.count})
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">When</th>
                <th className="px-4">Kind</th>
                <th className="px-4 text-right">Amount</th>
                <th className="px-4">Requested By</th>
                <th className="px-4">Approved By</th>
                <th className="px-4">Reason</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {approvals.map(a => (
                <tr key={a.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className={`py-3 px-4 font-mono text-[10px] ${mutedCls}`}>{a.approvedAt.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-4 text-[11px] font-bold">{APPROVAL_KIND_LABEL[a.kind]}</td>
                  <td className="px-4 text-right font-mono font-bold">{money(a.amount)}</td>
                  <td className="px-4 text-[11px]">{a.requestedBy}</td>
                  <td className="px-4 text-[11px] font-bold">
                    {a.approvedBy}
                    <span className={`block text-[9px] ${mutedCls}`}>{a.approverRole}</span>
                  </td>
                  <td className={`px-4 text-[11px] ${mutedCls}`}>{a.reason}</td>
                </tr>
              ))}
              {approvals.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-10 text-center ${mutedCls}`}>
                    No supervisor approvals recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
