import { Fragment, useState } from 'react';
import { ShieldCheck, Plus, X, Trash2, Lock, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  PERMISSIONS,
  DEFAULT_ROLES,
  validateRole,
  validateRoleDeletion,
  summariseRoles,
  can,
  type Role,
  type Permission,
} from '../lib/permissions';

interface RoleManagerProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  /** Roles currently assigned to a signed-in user, so one in use cannot be deleted. */
  assignedRoleNames: string[];
  currentRole: Role | null;
}

export default function RoleManager({ roles, setRoles, assignedRoleNames, currentRole }: RoleManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [editing, setEditing] = useState<Role | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseRoles(roles);
  const mayEdit = can(currentRole, 'admin.roles');

  const groups = [...new Set(PERMISSIONS.map(p => p.group))];

  const startNew = () => {
    setEditing({
      id: `role-${Date.now()}`, name: '', description: '',
      permissions: ['catalog.view'], isSystem: false,
    });
    setIsNew(true);
    setError('');
  };

  const toggle = (key: Permission) => {
    if (!editing) return;
    setEditing({
      ...editing,
      permissions: editing.permissions.includes(key)
        ? editing.permissions.filter(p => p !== key)
        : [...editing.permissions, key],
    });
    setError('');
  };

  const save = () => {
    if (!editing) return;
    const err = validateRole(editing, roles);
    if (err) { setError(err); return; }

    setRoles(prev => isNew ? [...prev, editing] : prev.map(r => r.id === editing.id ? editing : r));
    setEditing(null);
    setIsNew(false);
    setError('');
  };

  const remove = (id: string) => {
    const err = validateRoleDeletion(roles, id, assignedRoleNames);
    if (err) { setDeleteError(err); return; }
    setRoles(prev => prev.filter(r => r.id !== id));
    setDeleteError('');
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" /> Roles & Permissions
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Controls which screens and actions each role can reach.
            </p>
          </div>
          <button
            onClick={startNew}
            disabled={!mayEdit}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> New Role
          </button>
        </div>

        {/* Stated plainly, because the failure mode is someone later mistaking this for security. */}
        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${
          dark ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/60 border-amber-100'
        }`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
          <p className={`text-[11px] leading-relaxed ${dark ? 'text-amber-200/90' : 'text-amber-900'}`}>
            <span className="font-bold">This gates the interface, not the data.</span> There is no
            backend yet — everything lives in the browser, so this prevents mistakes and enforces
            process rather than stopping a determined actor. When a server exists, every one of
            these checks has to be re-asserted there.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Roles', value: String(summary.total) },
            { label: 'Custom Roles', value: String(summary.custom) },
            { label: 'Can Manage Roles', value: String(summary.administrators), accent: true },
            { label: 'Can Change Rates', value: String(summary.rateEditors), warn: summary.rateEditors > 2 },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.warn ? 'border-amber-500/40 bg-amber-500/5'
                : k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.warn ? 'text-amber-500' : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
            </div>
          ))}
        </div>

        {deleteError && (
          <p className="mt-3 text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 inline mr-1" />{deleteError}
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Permission Matrix</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Permission</th>
                {roles.map(r => (
                  <th key={r.id} className="px-3 text-center whitespace-nowrap">
                    {r.name}
                    {r.isSystem && <Lock className="w-2.5 h-2.5 inline ml-1 opacity-60" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {groups.map(group => (
                // Keyed Fragment, not <> — a bare fragment cannot take a key, and React warns
                // that the grouped rows have no stable identity.
                <Fragment key={group}>
                  <tr className={dark ? 'bg-zinc-900/40' : 'bg-slate-50/60'}>
                    <td colSpan={roles.length + 1}
                      className={`px-4 py-1.5 text-[9px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                      {group}
                    </td>
                  </tr>
                  {PERMISSIONS.filter(p => p.group === group).map(p => (
                    <tr key={p.key} className={`border-b last:border-0 ${rowCls}`}>
                      <td className="py-2.5 px-4">
                        <p className="text-[11px] font-bold">{p.label}</p>
                        {p.note && <p className={`text-[10px] mt-0.5 ${mutedCls}`}>{p.note}</p>}
                      </td>
                      {roles.map(r => (
                        <td key={r.id} className="px-3 text-center">
                          <span className={`text-sm font-bold ${
                            r.permissions.includes(p.key)
                              ? 'text-emerald-600 dark:text-emerald-400'
                              // zinc-700 measured 1.76:1 on the dark card — subdued is fine,
                              // illegible is not, since this mark carries the actual answer.
                              : dark ? 'text-zinc-500' : 'text-slate-400'
                          }`}>
                            {r.permissions.includes(p.key) ? '●' : '○'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Roles</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Role</th>
                <th className="px-4">Description</th>
                <th className="px-4 text-center">Permissions</th>
                <th className="px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {roles.map(r => (
                <tr key={r.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3.5 px-4 font-bold">
                    {r.name}
                    {r.isSystem && (
                      <span className={`ml-2 text-[9px] font-mono uppercase ${mutedCls}`}>built-in</span>
                    )}
                  </td>
                  <td className={`px-4 text-[11px] ${mutedCls}`}>{r.description}</td>
                  <td className="px-4 text-center font-mono">{r.permissions.length}</td>
                  <td className="px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => { setEditing({ ...r }); setIsNew(false); setError(''); }}
                        disabled={!mayEdit}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Edit
                      </button>
                      {!r.isSystem && (
                        <button
                          onClick={() => remove(r.id)}
                          disabled={!mayEdit}
                          aria-label={`Delete ${r.name}`}
                          className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                {isNew ? 'New Role' : `Edit ${editing.name || 'Role'}`}
              </h3>
              <button onClick={() => { setEditing(null); setError(''); }} aria-label="Close role"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Name</span>
                  <input value={editing.name} placeholder="Floor Lead"
                    onChange={e => { setEditing({ ...editing, name: e.target.value }); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>Description</span>
                  <input value={editing.description} placeholder="Runs the shop floor"
                    onChange={e => { setEditing({ ...editing, description: e.target.value }); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              {groups.map(group => (
                <div key={group} className="space-y-1.5">
                  <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>{group}</p>
                  {PERMISSIONS.filter(p => p.group === group).map(p => (
                    <label key={p.key}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                        editing.permissions.includes(p.key)
                          ? 'border-amber-500 bg-amber-500/5'
                          : dark ? 'border-zinc-800 hover:bg-zinc-900/40' : 'border-slate-150 hover:bg-slate-50'
                      }`}>
                      <input type="checkbox" checked={editing.permissions.includes(p.key)}
                        onChange={() => toggle(p.key)} className="accent-amber-500 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold">{p.label}</p>
                        {p.note && <p className={`text-[10px] mt-0.5 ${mutedCls}`}>{p.note}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              ))}

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={save}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                {isNew ? 'Create Role' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_ROLES };
