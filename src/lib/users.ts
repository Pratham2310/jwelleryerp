/**
 * User Management (Milestone 49, PRD §3.2).
 *
 * Milestone 32 defined *roles* — what a job title may do. This defines the *people* holding them.
 * The distinction matters because the audit trail names a person: M10 logs who overrode a price,
 * M33 logs who approved a discount, M42 logs who authorised a write-off. Without an operator
 * master those names are free text.
 *
 * ─── Deactivate, never delete ─────────────────────────────────────────────────────────
 * Removing a user would orphan every document they touched. An invoice raised by "Sharda M." must
 * still resolve that name years later, whether or not she still works here — so `isActive` gates
 * *selection*, never *resolution*. `resolveUserName()` deliberately looks up inactive users too;
 * that asymmetry is the whole design.
 *
 * ─── Where the supervisor PINs went ───────────────────────────────────────────────────
 * Milestone 33 shipped with its own list of supervisor names and PINs because there was no user
 * master to draw from. That list is now derived from these users instead, via
 * `supervisorsFromUsers()`, so a person's PIN and their authority to approve cannot drift apart —
 * deactivating someone withdraws their approval rights in the same action.
 */

import type { Role } from './permissions';
import { can } from './permissions';
import type { SupervisorPin } from './statutoryParameters';

export interface OperatorUser {
  id: string;
  name: string;
  /** Matches `Role.name`, not its id — roles are identified by name across this codebase. */
  roleName: string;
  branchId?: string;
  /** 4–6 digits. Doubles as the supervisor approval PIN when the role can approve. */
  pin: string;
  isActive: boolean;
  createdAt: string;
  deactivatedAt?: string;
  deactivationReason?: string;
}

export const DEFAULT_USERS: OperatorUser[] = [
  {
    id: 'usr-owner', name: 'Prathamesh S.', roleName: 'Owner', pin: '4821',
    isActive: true, createdAt: '2026-04-01',
  },
  {
    id: 'usr-manager', name: 'Sharda M.', roleName: 'Store Manager', pin: '9930',
    isActive: true, createdAt: '2026-04-01',
  },
  {
    id: 'usr-counter', name: 'Rakesh T.', roleName: 'Counter Staff', pin: '1122',
    isActive: true, createdAt: '2026-04-01',
  },
];

/* ─────────────────────────────── Reading ─────────────────────────────── */

export function activeUsers(users: OperatorUser[]): OperatorUser[] {
  return users.filter(u => u.isActive);
}

/**
 * Resolves a display name from an id, **including deactivated users**. A document raised by
 * someone who has since left must still name them; showing "Unknown" would lose information the
 * system holds.
 */
export function resolveUserName(userId: string, users: OperatorUser[]): string {
  return users.find(u => u.id === userId)?.name ?? 'Unknown operator';
}

export function userByPin(pin: string, users: OperatorUser[]): OperatorUser | null {
  const entered = (pin || '').trim();
  if (entered.length < 4) return null;
  // Only active users can authenticate — a deactivated PIN must stop working immediately.
  return activeUsers(users).find(u => u.pin === entered) ?? null;
}

export function roleOf(user: OperatorUser, roles: Role[]): Role | null {
  return roles.find(r => r.name.toLowerCase() === user.roleName.trim().toLowerCase()) ?? null;
}

/**
 * The supervisor roster Milestone 33 consumes, derived rather than kept separately.
 *
 * Only active users whose role can actually override a price appear: an approval from someone
 * without that authority is a signature, not a second pair of eyes — the same rule M33 stated,
 * now enforced from the user master rather than a parallel list.
 */
export function supervisorsFromUsers(users: OperatorUser[], roles: Role[]): SupervisorPin[] {
  return activeUsers(users)
    .filter(u => can(roleOf(u, roles), 'billing.override'))
    .map(u => ({ roleName: u.roleName, supervisorName: u.name, pin: u.pin }));
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export function validateUser(
  draft: OperatorUser,
  existing: OperatorUser[],
  roles: Role[]
): string | null {
  if (!draft.name.trim()) return 'Enter the operator\'s name.';
  if (!/^\d{4,6}$/.test((draft.pin || '').trim())) return 'The PIN must be 4 to 6 digits.';

  if (!roles.some(r => r.name.toLowerCase() === draft.roleName.trim().toLowerCase())) {
    return `${draft.roleName || 'That role'} is not a defined role.`;
  }

  const others = existing.filter(u => u.id !== draft.id);
  // A shared PIN would make the approval log name the wrong person.
  const pinClash = others.find(u => u.pin === draft.pin.trim() && u.isActive);
  if (pinClash) {
    return `That PIN already belongs to ${pinClash.name}. A shared PIN would name the wrong operator.`;
  }
  const nameClash = others.find(u => u.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  if (nameClash) {
    return `${nameClash.name} already exists. Two operators with one name make the audit trail ambiguous.`;
  }
  return null;
}

/** True when deactivating this user would leave nobody able to administer the system. */
export function wouldOrphanAdministration(
  users: OperatorUser[], roles: Role[], userId: string
): boolean {
  const remaining = activeUsers(users).filter(u => u.id !== userId);
  return !remaining.some(u => can(roleOf(u, roles), 'admin.roles'));
}

export function validateDeactivation(
  users: OperatorUser[], roles: Role[], userId: string, reason: string
): string | null {
  const user = users.find(u => u.id === userId);
  if (!user) return 'That operator no longer exists.';
  if (!user.isActive) return `${user.name} is already deactivated.`;
  if ((reason ?? '').trim().length < 4) {
    return 'Record why access is being withdrawn — it is what the audit trail keeps.';
  }
  if (wouldOrphanAdministration(users, roles, userId)) {
    return `${user.name} is the only active operator who can administer the system. `
      + 'Give another operator an administrator role first.';
  }
  return null;
}

/* ─────────────────────────────── Writing ─────────────────────────────── */

export function deactivateUser(
  users: OperatorUser[], userId: string, reason: string, at: string = new Date().toISOString()
): OperatorUser[] {
  // The record is kept in full — only the flag changes, so history still resolves the name.
  return users.map(u =>
    u.id === userId
      ? { ...u, isActive: false, deactivatedAt: at, deactivationReason: reason.trim() }
      : u
  );
}

export function reactivateUser(users: OperatorUser[], userId: string): OperatorUser[] {
  return users.map(u =>
    u.id === userId
      ? { ...u, isActive: true, deactivatedAt: undefined, deactivationReason: undefined }
      : u
  );
}

export function upsertUser(users: OperatorUser[], user: OperatorUser): OperatorUser[] {
  return users.some(u => u.id === user.id)
    ? users.map(u => (u.id === user.id ? user : u))
    : [...users, user];
}

export function blankUser(defaultRole: string, branchId?: string): OperatorUser {
  return {
    id: `usr-${Date.now()}`,
    name: '', roleName: defaultRole, branchId, pin: '',
    isActive: true, createdAt: new Date().toISOString().slice(0, 10),
  };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface UserSummary {
  total: number;
  active: number;
  deactivated: number;
  administrators: number;
  approvers: number;
}

export function summariseUsers(users: OperatorUser[], roles: Role[]): UserSummary {
  const active = activeUsers(users);
  return {
    total: users.length,
    active: active.length,
    deactivated: users.length - active.length,
    administrators: active.filter(u => can(roleOf(u, roles), 'admin.roles')).length,
    approvers: active.filter(u => can(roleOf(u, roles), 'billing.override')).length,
  };
}
