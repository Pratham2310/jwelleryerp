import { useState } from 'react';
import { ShieldCheck, Scale, UserCog, Activity } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import RoleManager from './RoleManager';
import StatutoryPanel from './StatutoryPanel';
import UserManagerPanel from './UserManagerPanel';
import SystemHealthPanel from './SystemHealthPanel';
import type { StatutoryParameters, ApprovalRecord, Branch } from '../types';
import type { SupervisorPin } from '../lib/statutoryParameters';
import type { OperatorUser } from '../lib/users';
import { can, type Role } from '../lib/permissions';

interface AdminSettingsProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  assignedRoleNames: string[];
  currentRole: Role | null;
  statutoryParameters: StatutoryParameters;
  setStatutoryParameters: React.Dispatch<React.SetStateAction<StatutoryParameters>>;
  approvals: ApprovalRecord[];
  /** Derived from the user master (Milestone 49) rather than kept as a separate list. */
  supervisors: SupervisorPin[];
  users: OperatorUser[];
  setUsers: React.Dispatch<React.SetStateAction<OperatorUser[]>>;
  branches: Branch[];
  forceOffline: boolean;
  latencyMs: number;
  queuedSales: number;
  queueConflicts: number;
}

const TABS = [
  { key: 'roles' as const, label: 'Roles & Access', icon: ShieldCheck },
  { key: 'users' as const, label: 'Operators', icon: UserCog },
  { key: 'statutory' as const, label: 'Statutory & Approvals', icon: Scale },
  { key: 'health' as const, label: 'System Health', icon: Activity },
];

type Tab = typeof TABS[number]['key'];

/**
 * The administration screens live together because they answer adjacent questions: who may act
 * (M32), who *is* acting (M49), under what limits and whose sign-off (M33–M34), and whether the
 * system underneath is actually healthy (M51).
 */
export default function AdminSettings({
  roles, setRoles, assignedRoleNames, currentRole,
  statutoryParameters, setStatutoryParameters, approvals, supervisors,
  users, setUsers, branches, forceOffline, latencyMs, queuedSales, queueConflicts,
}: AdminSettingsProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [tab, setTab] = useState<Tab>('roles');

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap gap-1 p-1 rounded-xl border w-fit ${
        dark ? 'bg-[#141416] border-[#262626]' : 'bg-white border-slate-150'
      }`}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === t.key
                ? 'bg-[#C5A059] text-[#0A0A0B]'
                : dark ? 'text-zinc-400 hover:text-zinc-100' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && (
        <RoleManager
          roles={roles}
          setRoles={setRoles}
          assignedRoleNames={assignedRoleNames}
          currentRole={currentRole}
        />
      )}

      {tab === 'users' && (
        <UserManagerPanel
          users={users}
          setUsers={setUsers}
          roles={roles}
          branches={branches}
          canEdit={can(currentRole, 'admin.roles')}
        />
      )}

      {tab === 'statutory' && (
        <StatutoryPanel
          parameters={statutoryParameters}
          setParameters={setStatutoryParameters}
          approvals={approvals}
          supervisors={supervisors}
          canEdit={can(currentRole, 'masters.manage')}
        />
      )}

      {tab === 'health' && (
        <SystemHealthPanel
          forceOffline={forceOffline}
          latencyMs={latencyMs}
          queuedSales={queuedSales}
          queueConflicts={queueConflicts}
        />
      )}
    </div>
  );
}
