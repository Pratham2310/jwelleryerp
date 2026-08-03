import { useState } from 'react';
import { UserCog, Plus, X, AlertTriangle, Info, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Branch } from '../types';
import {
  activeUsers,
  validateUser,
  validateDeactivation,
  deactivateUser,
  reactivateUser,
  upsertUser,
  blankUser,
  summariseUsers,
  roleOf,
  type OperatorUser,
} from '../lib/users';
import { can, type Role } from '../lib/permissions';

interface UserManagerPanelProps {
  users: OperatorUser[];
  setUsers: React.Dispatch<React.SetStateAction<OperatorUser[]>>;
  roles: Role[];
  branches: Branch[];
  canEdit: boolean;
}

export default function UserManagerPanel({
  users, setUsers, roles, branches, canEdit,
}: UserManagerPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [editing, setEditing] = useState<OperatorUser | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [deactivating, setDeactivating] = useState<OperatorUser | null>(null);
  const [reason, setReason] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseUsers(users, roles);

  const startNew = () => {
    setEditing(blankUser(roles[roles.length - 1]?.name ?? 'Counter Staff'));
    setIsNew(true);
    setError('');
  };

  const save = () => {
    if (!editing) return;
    const err = validateUser(editing, users, roles);
    if (err) { setError(err); return; }
    setUsers(prev => upsertUser(prev, { ...editing, name: editing.name.trim() }));
    setEditing(null); setIsNew(false); setError('');
  };

  const confirmDeactivate = () => {
    if (!deactivating) return;
    const err = validateDeactivation(users, roles, deactivating.id, reason);
    if (err) { setDeactivateError(err); return; }
    setUsers(prev => deactivateUser(prev, deactivating.id, reason));
    setDeactivating(null); setReason(''); setDeactivateError('');
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <UserCog className="w-4 h-4 text-amber-500" /> Operators
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              The people holding the roles. Roles say what a job may do; this says who is doing it.
            </p>
          </div>
          <button onClick={startNew} disabled={!canEdit}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Operator
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Active', value: String(summary.active), accent: true },
            { label: 'Deactivated', value: String(summary.deactivated) },
            { label: 'Administrators', value: String(summary.administrators) },
            { label: 'Can Approve Overrides', value: String(summary.approvers) },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            Operators are <span className="font-bold">deactivated, never deleted</span>. Removing one
            would orphan every document they touched — an invoice raised years ago must still name
            who raised it. Deactivating withdraws access and their supervisor PIN in the same action.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Operator</th>
                <th className="px-4">Role</th>
                <th className="px-4">Branch</th>
                <th className="px-4">PIN</th>
                <th className="px-4">Status</th>
                <th className="px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {users.map(u => {
                const role = roleOf(u, roles);
                return (
                  <tr key={u.id} className={`border-b last:border-0 ${rowCls} ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-bold block">{u.name}</span>
                      <span className={`text-[9px] font-mono ${mutedCls}`}>since {u.createdAt}</span>
                    </td>
                    <td className="px-4 text-[11px]">
                      {u.roleName}
                      {!role && <span className="text-rose-500 block text-[9px]">role no longer defined</span>}
                    </td>
                    <td className={`px-4 text-[11px] ${mutedCls}`}>
                      {branches.find(b => b.id === u.branchId)?.name ?? 'All branches'}
                    </td>
                    <td className={`px-4 font-mono text-xs tracking-[0.3em] ${mutedCls}`}>••••</td>
                    <td className="px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                        u.isActive
                          ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                      {!u.isActive && u.deactivationReason && (
                        <span className={`block text-[9px] mt-0.5 ${mutedCls}`}>{u.deactivationReason}</span>
                      )}
                      {u.isActive && can(role, 'billing.override') && (
                        <span className={`block text-[9px] mt-0.5 ${mutedCls}`}>can approve overrides</span>
                      )}
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <button onClick={() => { setEditing(u); setIsNew(false); setError(''); }} disabled={!canEdit}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition disabled:opacity-30 ${
                          dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}>
                        Edit
                      </button>
                      {u.isActive ? (
                        <button onClick={() => { setDeactivating(u); setReason(''); setDeactivateError(''); }} disabled={!canEdit}
                          className="ml-1.5 px-2.5 py-1 rounded-lg border border-rose-500/40 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => setUsers(prev => reactivateUser(prev, u.id))} disabled={!canEdit}
                          className="ml-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-30">
                          <RotateCcw className="w-3 h-3 inline -mt-0.5 mr-1" />Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} className={`py-10 text-center ${mutedCls}`}>No operators defined.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / edit */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">{isNew ? 'New Operator' : `Edit ${editing.name}`}</h3>
              <button onClick={() => { setEditing(null); setError(''); }} aria-label="Close operator"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Name</span>
                <input value={editing.name} aria-label="Operator name"
                  onChange={e => { setEditing({ ...editing, name: e.target.value }); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Role</span>
                <select value={editing.roleName} aria-label="Operator role"
                  onChange={e => { setEditing({ ...editing, roleName: e.target.value }); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </label>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Branch</span>
                <select value={editing.branchId ?? ''} aria-label="Operator branch"
                  onChange={e => setEditing({ ...editing, branchId: e.target.value || undefined })}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                  <option value="">All branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  PIN (4–6 digits)
                </span>
                <input value={editing.pin} inputMode="numeric" maxLength={6} aria-label="Operator PIN"
                  onChange={e => { setEditing({ ...editing, pin: e.target.value }); setError(''); }}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                <span className={`text-[10px] ${mutedCls}`}>
                  Doubles as the supervisor approval PIN when the role can override a price.
                </span>
              </label>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setEditing(null); setError(''); }}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={save}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate */}
      {deactivating && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">Deactivate {deactivating.name}</h3>
              <button onClick={() => setDeactivating(null)} aria-label="Cancel deactivation"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                Their access and supervisor PIN stop working immediately. Every document they
                raised keeps their name — nothing is deleted.
              </p>
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Reason</span>
                <input value={reason} aria-label="Deactivation reason" placeholder="Left the company, transferred, …"
                  onChange={e => { setReason(e.target.value); setDeactivateError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              {deactivateError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{deactivateError}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setDeactivating(null)}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={confirmDeactivate}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition">
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
