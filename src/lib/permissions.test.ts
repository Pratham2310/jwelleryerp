import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  roleByName,
  can,
  canAny,
  missingPermissions,
  permissionLabel,
  wouldOrphanAdministration,
  wouldOrphanByDeleting,
  validateRole,
  validateRoleDeletion,
  canAccessRoute,
  ROUTE_PERMISSION,
  summariseRoles,
  type Role,
} from './permissions';

const owner = DEFAULT_ROLES.find(r => r.id === 'role-owner')!;
const manager = DEFAULT_ROLES.find(r => r.id === 'role-manager')!;
const cashier = DEFAULT_ROLES.find(r => r.id === 'role-cashier')!;
const accountant = DEFAULT_ROLES.find(r => r.id === 'role-accountant')!;

function role(over: Partial<Role> = {}): Role {
  return {
    id: 'role-custom', name: 'Custom', description: 'A custom role',
    permissions: ['catalog.view'], isSystem: false, ...over,
  };
}

describe('permission catalogue', () => {
  it('has no duplicate keys', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('gives every permission a label and a group', () => {
    for (const p of PERMISSIONS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.group.length).toBeGreaterThan(0);
    }
  });

  it('separates applying a discount from overriding a price', () => {
    // An override changes the calculated rate itself, which is why M10 logs a reason for it.
    expect(ALL_PERMISSIONS).toContain('billing.discount');
    expect(ALL_PERMISSIONS).toContain('billing.override');
    expect(can(cashier, 'billing.discount')).toBe(true);
    expect(can(cashier, 'billing.override')).toBe(false);
  });

  it('labels an unknown permission as itself rather than throwing', () => {
    expect(permissionLabel('nonsense' as never)).toBe('nonsense');
  });
});

describe('can — an unknown role gets nothing', () => {
  it('grants what the role holds', () => {
    expect(can(owner, 'admin.roles')).toBe(true);
    expect(can(manager, 'billing.create')).toBe(true);
  });

  it('denies what it does not', () => {
    expect(can(manager, 'admin.roles')).toBe(false);
    expect(can(cashier, 'accounting.view')).toBe(false);
    expect(can(accountant, 'billing.create')).toBe(false);
  });

  it('denies EVERYTHING for a null role', () => {
    // Defaulting an unrecognised role to full access is how a permission system quietly stops
    // working — one typo in a role name would unlock the whole app.
    for (const p of ALL_PERMISSIONS) expect(can(null, p)).toBe(false);
  });

  it('resolves a role by name case-insensitively, and null when absent', () => {
    expect(roleByName(DEFAULT_ROLES, 'store manager')?.id).toBe('role-manager');
    expect(roleByName(DEFAULT_ROLES, '  Owner  ')?.id).toBe('role-owner');
    expect(roleByName(DEFAULT_ROLES, 'Nonexistent')).toBeNull();
  });

  it('canAny is true when any one is held', () => {
    expect(canAny(cashier, ['admin.roles', 'billing.create'])).toBe(true);
    expect(canAny(cashier, ['admin.roles', 'rates.edit'])).toBe(false);
  });

  it('reports which permissions are missing, for explaining a denial', () => {
    expect(missingPermissions(cashier, ['billing.create', 'rates.edit', 'admin.roles']))
      .toEqual(['rates.edit', 'admin.roles']);
    expect(missingPermissions(owner, ALL_PERMISSIONS)).toEqual([]);
  });
});

describe('default roles are sensibly separated', () => {
  it('gives the owner everything', () => {
    expect(owner.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });

  it('withholds role administration from the manager', () => {
    expect(can(manager, 'admin.roles')).toBe(false);
    expect(can(manager, 'rates.edit')).toBe(true);
  });

  it('keeps counter staff away from rates, books and overrides', () => {
    expect(can(cashier, 'rates.edit')).toBe(false);
    expect(can(cashier, 'accounting.view')).toBe(false);
    expect(can(cashier, 'billing.override')).toBe(false);
    expect(can(cashier, 'billing.create')).toBe(true);
  });

  it('keeps the accountant out of selling and stock handling', () => {
    expect(can(accountant, 'billing.create')).toBe(false);
    expect(can(accountant, 'stock.transfer')).toBe(false);
    expect(can(accountant, 'accounting.post')).toBe(true);
  });

  it('marks every shipped role as a system role', () => {
    expect(DEFAULT_ROLES.every(r => r.isSystem)).toBe(true);
  });
});

describe('the system must stay administrable', () => {
  it('detects an edit that would remove the last administrator', () => {
    const soleAdmin = [role({ id: 'r1', permissions: ['admin.roles'] }), role({ id: 'r2' })];
    const stripped = role({ id: 'r1', permissions: ['catalog.view'] });
    expect(wouldOrphanAdministration(soleAdmin, stripped)).toBe(true);
  });

  it('allows the same edit while another administrator remains', () => {
    const two = [
      role({ id: 'r1', permissions: ['admin.roles'] }),
      role({ id: 'r2', permissions: ['admin.roles'] }),
    ];
    expect(wouldOrphanAdministration(two, role({ id: 'r1', permissions: ['catalog.view'] }))).toBe(false);
  });

  it('does not treat a brand-new non-admin role as orphaning', () => {
    const existing = [role({ id: 'r1', permissions: ['admin.roles'] })];
    expect(wouldOrphanAdministration(existing, role({ id: 'new' }))).toBe(false);
  });

  it('detects a deletion that would remove the last administrator', () => {
    const roles = [role({ id: 'r1', permissions: ['admin.roles'] }), role({ id: 'r2' })];
    expect(wouldOrphanByDeleting(roles, 'r1')).toBe(true);
    expect(wouldOrphanByDeleting(roles, 'r2')).toBe(false);
  });
});

describe('validateRole', () => {
  const existing = [role({ id: 'r1', name: 'Admin', permissions: ['admin.roles'] })];

  it('accepts a well-formed role', () => {
    expect(validateRole(role({ id: 'new', name: 'Floor Lead' }), existing)).toBeNull();
  });

  it('requires a name and a description', () => {
    expect(validateRole(role({ id: 'new', name: '' }), existing)).toMatch(/give the role a name/i);
    expect(validateRole(role({ id: 'new', description: '' }), existing)).toMatch(/describe what this role/i);
  });

  it('refuses a duplicate name, ignoring case', () => {
    expect(validateRole(role({ id: 'new', name: 'admin' }), existing)).toMatch(/already exists/i);
  });

  it('refuses a role with no permissions at all', () => {
    expect(validateRole(role({ id: 'new', permissions: [] }), existing))
      .toMatch(/cannot do anything/i);
  });

  it('refuses the edit that would lock everyone out of this screen', () => {
    const err = validateRole(role({ id: 'r1', name: 'Admin', permissions: ['catalog.view'] }), existing);
    expect(err).toMatch(/at least one role must keep/i);
    expect(err).toMatch(/lock everyone out/i);
  });
});

describe('validateRoleDeletion', () => {
  const roles = [
    role({ id: 'r1', name: 'Admin', permissions: ['admin.roles'] }),
    role({ id: 'r2', name: 'Floor Lead' }),
    role({ id: 'r3', name: 'Owner', isSystem: true, permissions: ['admin.roles'] }),
  ];

  it('allows deleting an unused custom role', () => {
    expect(validateRoleDeletion(roles, 'r2', [])).toBeNull();
  });

  it('refuses to delete a built-in role', () => {
    expect(validateRoleDeletion(roles, 'r3', [])).toMatch(/built-in role/i);
  });

  it('refuses to delete a role someone is assigned to', () => {
    // Deleting it would leave that user with no permissions at all.
    expect(validateRoleDeletion(roles, 'r2', ['Floor Lead'])).toMatch(/assigned to at least one user/i);
  });

  it('is case-insensitive about the assignment check', () => {
    expect(validateRoleDeletion(roles, 'r2', ['floor lead'])).toMatch(/assigned to/i);
  });

  it('refuses to delete the last administrator', () => {
    const onlyAdmin = [role({ id: 'r1', name: 'Admin', permissions: ['admin.roles'] }), role({ id: 'r2', name: 'Other' })];
    expect(validateRoleDeletion(onlyAdmin, 'r1', [])).toMatch(/only role that can manage roles/i);
  });

  it('reports a role that no longer exists', () => {
    expect(validateRoleDeletion(roles, 'ghost', [])).toMatch(/no longer exists/i);
  });
});

describe('route gating', () => {
  it('lets the owner everywhere', () => {
    for (const path of Object.keys(ROUTE_PERMISSION)) {
      expect(canAccessRoute(owner, path)).toBe(true);
    }
  });

  it('keeps counter staff out of the books and the customer master', () => {
    expect(canAccessRoute(cashier, '/accounting')).toBe(false);
    expect(canAccessRoute(cashier, '/customers')).toBe(false);
    expect(canAccessRoute(cashier, '/billing')).toBe(true);
    expect(canAccessRoute(cashier, '/catalog')).toBe(true);
  });

  it('keeps the accountant out of billing', () => {
    expect(canAccessRoute(accountant, '/billing')).toBe(false);
    expect(canAccessRoute(accountant, '/accounting')).toBe(true);
  });

  it('leaves an ungated route open, so a denied user still lands somewhere', () => {
    expect(canAccessRoute(cashier, '/dashboard')).toBe(true);
    expect(canAccessRoute(null, '/dashboard')).toBe(true);
  });

  it('denies every gated route to an unknown role', () => {
    for (const path of Object.keys(ROUTE_PERMISSION)) {
      expect(canAccessRoute(null, path)).toBe(false);
    }
  });
});

describe('summariseRoles', () => {
  it('summarises the shipped set', () => {
    const s = summariseRoles(DEFAULT_ROLES);
    expect(s.total).toBe(4);
    expect(s.custom).toBe(0);
    expect(s.administrators).toBe(1); // owner only
    expect(s.rateEditors).toBe(2);    // owner and manager
  });

  it('counts custom roles separately', () => {
    expect(summariseRoles([...DEFAULT_ROLES, role()]).custom).toBe(1);
  });

  it('handles an empty set', () => {
    expect(summariseRoles([])).toEqual({ total: 0, custom: 0, administrators: 0, rateEditors: 0 });
  });
});
