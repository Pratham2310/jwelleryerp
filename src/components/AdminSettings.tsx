import { useState } from 'react';
import { ShieldCheck, Scale } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import RoleManager from './RoleManager';
import StatutoryPanel from './StatutoryPanel';
import type { StatutoryParameters, ApprovalRecord } from '../types';
import type { SupervisorPin } from '../lib/statutoryParameters';
import { can, type Role } from '../lib/permissions';

interface AdminSettingsProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  assignedRoleNames: string[];
  currentRole: Role | null;
  statutoryParameters: StatutoryParameters;
  setStatutoryParameters: React.Dispatch<React.SetStateAction<StatutoryParameters>>;
  approvals: ApprovalRecord[];
  supervisors: SupervisorPin[];
  setSupervisors: React.Dispatch<React.SetStateAction<SupervisorPin[]>>;
}

const TABS = [
  { key: 'roles' as const, label: 'Roles & Access', icon: ShieldCheck },
  { key: 'statutory' as const, label: 'Statutory & Approvals', icon: Scale },
];

/**
 * The two administration screens live together because they answer adjacent questions:
 * who may act (Milestone 32), and under what limits and whose sign-off (Milestones 33-34).
 */
export default function AdminSettings({
  roles, setRoles, assignedRoleNames, currentRole,
  statutoryParameters, setStatutoryParameters, approvals, supervisors, setSupervisors,
}: AdminSettingsProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [tab, setTab] = useState<'roles' | 'statutory'>('roles');

  // Only roles that can override a price may be named as approvers.
  const approvingRoleNames = roles.filter(r => r.permissions.includes('billing.override')).map(r => r.name);

  return (
    <div className="space-y-6">
      <div className={`flex gap-1 p-1 rounded-xl border w-fit ${
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

      {tab === 'roles' ? (
        <RoleManager
          roles={roles}
          setRoles={setRoles}
          assignedRoleNames={assignedRoleNames}
          currentRole={currentRole}
        />
      ) : (
        <StatutoryPanel
          parameters={statutoryParameters}
          setParameters={setStatutoryParameters}
          approvals={approvals}
          supervisors={supervisors}
          setSupervisors={setSupervisors}
          approvingRoleNames={approvingRoleNames}
          canEdit={can(currentRole, 'masters.manage')}
        />
      )}
    </div>
  );
}
