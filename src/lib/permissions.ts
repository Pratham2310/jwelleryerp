/**
 * Roles & Permissions (PRD §15, Handbook Phase 12, Milestone 32).
 *
 * ─── What this is, and what it is not ─────────────────────────────────────────────────
 * This gates **UI affordances**, not data. There is no backend — everything lives in
 * `localStorage` and anyone with a browser console can rewrite it. So this is a control against
 * *mistakes and process violations*, not against a determined actor: it stops a counter assistant
 * from wandering into the accounting screens or approving their own discount, which is what a
 * shop actually needs day to day.
 *
 * That distinction is stated here rather than left implied, because the failure mode is someone
 * later treating a checkbox on this screen as though it enforced security. When a backend exists,
 * every one of these checks has to be re-asserted server-side; the permission names are designed
 * to port across unchanged so that is a re-implementation, not a redesign.
 *
 * ─── The rule that keeps the system administrable ──────────────────────────────────────
 * At least one role must always retain `admin.roles`. Remove it from the last one and nobody can
 * ever grant it back — the shop would be permanently locked out of its own permission screen with
 * no recovery path short of clearing storage. `wouldOrphanAdministration()` refuses that edit.
 */

export type Permission =
  // Billing
  | 'billing.create'
  | 'billing.discount'
  | 'billing.override'
  | 'billing.return'
  // Inventory
  | 'catalog.view'
  | 'catalog.manage'
  | 'stock.transfer'
  | 'stock.audit'
  | 'hallmark.manage'
  // Procurement
  | 'purchase.view'
  | 'purchase.manage'
  // Money
  | 'accounting.view'
  | 'accounting.post'
  | 'rates.edit'
  // Masters & admin
  | 'masters.manage'
  | 'customers.manage'
  | 'karigar.manage'
  | 'admin.roles';

export interface PermissionDef {
  key: Permission;
  label: string;
  group: string;
  /** Why this one is worth separating, shown as help text on the matrix. */
  note?: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'billing.create', label: 'Raise invoices & estimates', group: 'Billing' },
  { key: 'billing.discount', label: 'Apply a discount', group: 'Billing' },
  {
    key: 'billing.override', label: 'Override a price', group: 'Billing',
    note: 'Separate from applying a discount: an override changes the calculated rate itself, which is why Milestone 10 makes it require a logged reason.',
  },
  { key: 'billing.return', label: 'Process returns & credit notes', group: 'Billing' },

  { key: 'catalog.view', label: 'View catalogue & stock', group: 'Inventory' },
  { key: 'catalog.manage', label: 'Add & edit tags and designs', group: 'Inventory' },
  { key: 'stock.transfer', label: 'Dispatch & receive branch transfers', group: 'Inventory' },
  { key: 'stock.audit', label: 'Run a physical stock audit', group: 'Inventory' },
  { key: 'hallmark.manage', label: 'Manage hallmarking & HUIDs', group: 'Inventory' },

  { key: 'purchase.view', label: 'View purchases', group: 'Procurement' },
  {
    key: 'purchase.manage', label: 'Raise orders, receive goods, book bills', group: 'Procurement',
    note: 'Includes booking input tax credit, which is why it is not given to counter staff by default.',
  },

  { key: 'accounting.view', label: 'View books & statements', group: 'Accounting' },
  {
    key: 'accounting.post', label: 'Post manual vouchers', group: 'Accounting',
    note: 'A manual voucher has no source document behind it, so this is effectively permission to write to the ledger by hand.',
  },
  {
    key: 'rates.edit', label: 'Change metal rates', group: 'Accounting',
    note: 'The single most load-bearing number in the shop — it prices every sale, buyback and valuation.',
  },

  { key: 'masters.manage', label: 'Manage branches, tax & schemes', group: 'Masters' },
  { key: 'customers.manage', label: 'Manage customers & suppliers', group: 'Masters' },
  { key: 'karigar.manage', label: 'Manage karigars & job work', group: 'Masters' },
  {
    key: 'admin.roles', label: 'Manage roles & permissions', group: 'Administration',
    note: 'At least one role must always keep this, or nobody can ever grant it back.',
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map(p => p.key);

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Shipped roles cannot be deleted — a shop that removed them all would have nothing to log in as. */
  isSystem: boolean;
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-owner',
    name: 'Owner',
    description: 'Full access, including roles and rates.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    id: 'role-manager',
    name: 'Store Manager',
    description: 'Runs the shop day to day. No role administration.',
    permissions: ALL_PERMISSIONS.filter(p => p !== 'admin.roles'),
    isSystem: true,
  },
  {
    id: 'role-cashier',
    name: 'Counter Staff',
    description: 'Sells and views stock. Cannot override prices, touch rates or see the books.',
    permissions: ['billing.create', 'billing.discount', 'catalog.view', 'purchase.view'],
    isSystem: true,
  },
  {
    id: 'role-accountant',
    name: 'Accountant',
    description: 'Books and purchases. No selling, no stock handling.',
    permissions: [
      'accounting.view', 'accounting.post', 'purchase.view', 'purchase.manage',
      'catalog.view', 'customers.manage',
    ],
    isSystem: true,
  },
];

/* ─────────────────────────────── Checking ─────────────────────────────── */

export function roleByName(roles: Role[], name: string): Role | null {
  const target = (name || '').trim().toLowerCase();
  return roles.find(r => r.name.toLowerCase() === target) ?? null;
}

/**
 * Whether a role grants a permission.
 *
 * An unknown role gets nothing rather than everything. Defaulting an unrecognised role to full
 * access is the classic way a permission system quietly stops working — a typo in a role name
 * would silently unlock the whole app.
 */
export function can(role: Role | null, permission: Permission): boolean {
  return !!role?.permissions.includes(permission);
}

export function canAny(role: Role | null, permissions: Permission[]): boolean {
  return permissions.some(p => can(role, p));
}

/** Permissions a role is missing, for explaining a denial rather than just refusing. */
export function missingPermissions(role: Role | null, required: Permission[]): Permission[] {
  return required.filter(p => !can(role, p));
}

export function permissionLabel(key: Permission): string {
  return PERMISSIONS.find(p => p.key === key)?.label ?? key;
}

/* ─────────────────────────────── Editing ─────────────────────────────── */

/**
 * True when applying `next` would leave no role able to manage roles.
 *
 * This is the check that keeps the system recoverable. Without it, unticking one box on the last
 * privileged role locks the shop out of its own administration permanently.
 */
export function wouldOrphanAdministration(roles: Role[], next: Role): boolean {
  const after = roles.map(r => (r.id === next.id ? next : r));
  // A brand-new role that is not yet in the list cannot orphan anything by itself.
  if (!roles.some(r => r.id === next.id)) after.push(next);
  return !after.some(r => r.permissions.includes('admin.roles'));
}

export function wouldOrphanByDeleting(roles: Role[], roleId: string): boolean {
  return !roles.filter(r => r.id !== roleId).some(r => r.permissions.includes('admin.roles'));
}

export function validateRole(draft: Partial<Role>, existing: Role[]): string | null {
  if (!draft.name?.trim()) return 'Give the role a name.';
  if (!draft.description?.trim()) return 'Describe what this role is for.';

  const name = draft.name.trim().toLowerCase();
  if (existing.some(r => r.id !== draft.id && r.name.toLowerCase() === name)) {
    return `A role called "${draft.name.trim()}" already exists.`;
  }

  if (!draft.permissions?.length) {
    return 'A role with no permissions cannot do anything — grant at least one.';
  }

  if (wouldOrphanAdministration(existing, draft as Role)) {
    return 'At least one role must keep "Manage roles & permissions" — removing it here would lock everyone out of this screen for good.';
  }
  return null;
}

export function validateRoleDeletion(
  roles: Role[],
  roleId: string,
  assignedRoleNames: string[]
): string | null {
  const role = roles.find(r => r.id === roleId);
  if (!role) return 'That role no longer exists.';
  if (role.isSystem) return `${role.name} is a built-in role and cannot be deleted.`;

  // Deleting a role someone is logged in as would leave them with no permissions at all.
  const inUse = assignedRoleNames.some(n => n.toLowerCase() === role.name.toLowerCase());
  if (inUse) return `${role.name} is assigned to at least one user — reassign them first.`;

  if (wouldOrphanByDeleting(roles, roleId)) {
    return `${role.name} is the only role that can manage roles. Grant that to another role first.`;
  }
  return null;
}

/* ─────────────────────────────── Navigation ─────────────────────────────── */

/**
 * Which permission each screen needs. A screen with no entry is open to everyone —
 * the Dashboard, deliberately, so a denied user still lands somewhere.
 */
export const ROUTE_PERMISSION: Record<string, Permission> = {
  '/catalog': 'catalog.view',
  '/stones': 'catalog.view',
  '/billing': 'billing.create',
  '/karigar': 'karigar.manage',
  '/jobbags': 'karigar.manage',
  '/oldgold': 'billing.create',
  '/customers': 'customers.manage',
  '/purchases': 'purchase.view',
  '/accounting': 'accounting.view',
  '/reports': 'accounting.view',
  '/roles': 'admin.roles',
};

export function canAccessRoute(role: Role | null, path: string): boolean {
  const required = ROUTE_PERMISSION[path];
  return required ? can(role, required) : true;
}

export interface RoleSummary {
  total: number;
  custom: number;
  administrators: number;
  /** Roles that can change the metal rate — worth knowing at a glance. */
  rateEditors: number;
}

export function summariseRoles(roles: Role[]): RoleSummary {
  return {
    total: roles.length,
    custom: roles.filter(r => !r.isSystem).length,
    administrators: roles.filter(r => r.permissions.includes('admin.roles')).length,
    rateEditors: roles.filter(r => r.permissions.includes('rates.edit')).length,
  };
}
