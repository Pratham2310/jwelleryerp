import { describe, it, expect } from 'vitest';
import {
  DEFAULT_USERS,
  activeUsers,
  resolveUserName,
  userByPin,
  roleOf,
  supervisorsFromUsers,
  validateUser,
  wouldOrphanAdministration,
  validateDeactivation,
  deactivateUser,
  reactivateUser,
  upsertUser,
  blankUser,
  summariseUsers,
  type OperatorUser,
} from './users';
import { DEFAULT_ROLES } from './permissions';

const roles = DEFAULT_ROLES;

const user = (over: Partial<OperatorUser> = {}): OperatorUser => ({
  id: 'u1', name: 'Test Person', roleName: 'Store Manager', pin: '5555',
  isActive: true, createdAt: '2026-04-01', ...over,
});

describe('shipped users', () => {
  it('all validate against their own rules', () => {
    for (const u of DEFAULT_USERS) {
      expect(validateUser(u, DEFAULT_USERS, roles)).toBeNull();
    }
  });

  it('includes at least one administrator', () => {
    expect(summariseUsers(DEFAULT_USERS, roles).administrators).toBeGreaterThan(0);
  });
});

describe('deactivate, never delete', () => {
  const users = [user({ id: 'u1', name: 'Sharda M.' }), user({ id: 'u2', name: 'Rakesh T.', pin: '6666' })];

  it('keeps the record when deactivating', () => {
    const after = deactivateUser(users, 'u1', 'Left the company', 'T');
    expect(after).toHaveLength(2);
    expect(after[0].isActive).toBe(false);
    expect(after[0].deactivatedAt).toBe('T');
    expect(after[0].deactivationReason).toBe('Left the company');
  });

  it('RESOLVES the name of a deactivated user — past documents must still name them', () => {
    const after = deactivateUser(users, 'u1', 'Left the company');
    expect(resolveUserName('u1', after)).toBe('Sharda M.');
  });

  it('removes them from the selectable list', () => {
    const after = deactivateUser(users, 'u1', 'Left the company');
    expect(activeUsers(after).map(u => u.id)).toEqual(['u2']);
  });

  it('stops their PIN working immediately', () => {
    const after = deactivateUser(users, 'u1', 'Left the company');
    expect(userByPin('5555', after)).toBeNull();
    expect(userByPin('5555', users)).not.toBeNull();
  });

  it('can be reversed, clearing the deactivation record', () => {
    const back = reactivateUser(deactivateUser(users, 'u1', 'Left the company'), 'u1');
    expect(back[0].isActive).toBe(true);
    expect(back[0].deactivatedAt).toBeUndefined();
  });

  it('names an unknown id rather than crashing', () => {
    expect(resolveUserName('ghost', users)).toBe('Unknown operator');
  });
});

describe('validateUser', () => {
  const existing = [user({ id: 'u1', name: 'Sharda M.', pin: '5555' })];

  it('accepts a well-formed new operator', () => {
    expect(validateUser(user({ id: 'u2', name: 'New Person', pin: '7777' }), existing, roles)).toBeNull();
  });

  it('requires a name and a 4-6 digit PIN', () => {
    expect(validateUser(user({ id: 'u2', name: ' ' }), existing, roles)).toMatch(/name/i);
    expect(validateUser(user({ id: 'u2', pin: '12' }), existing, roles)).toMatch(/4 to 6 digits/i);
    expect(validateUser(user({ id: 'u2', pin: 'abcd' }), existing, roles)).toMatch(/4 to 6 digits/i);
  });

  it('refuses a role that is not defined', () => {
    expect(validateUser(user({ id: 'u2', roleName: 'Wizard' }), existing, roles)).toMatch(/not a defined role/i);
  });

  it('refuses a shared PIN, which would name the wrong operator in the log', () => {
    expect(validateUser(user({ id: 'u2', name: 'Other', pin: '5555' }), existing, roles))
      .toMatch(/already belongs to Sharda M\./i);
  });

  it('refuses a duplicate name — an ambiguous audit trail is worse than an inconvenience', () => {
    expect(validateUser(user({ id: 'u2', name: 'sharda m.', pin: '7777' }), existing, roles))
      .toMatch(/already exists/i);
  });

  it('lets an existing operator keep their own PIN and name while being edited', () => {
    expect(validateUser(user({ id: 'u1', name: 'Sharda M.', pin: '5555' }), existing, roles)).toBeNull();
  });

  it('allows reusing a deactivated operator\'s PIN', () => {
    const gone = [user({ id: 'u1', name: 'Gone', pin: '5555', isActive: false })];
    expect(validateUser(user({ id: 'u2', name: 'New', pin: '5555' }), gone, roles)).toBeNull();
  });
});

describe('administration can never be orphaned', () => {
  const owner = user({ id: 'u1', name: 'Owner P', roleName: 'Owner', pin: '1111' });
  const staff = user({ id: 'u2', name: 'Counter R', roleName: 'Counter Staff', pin: '2222' });

  it('detects the last administrator', () => {
    expect(wouldOrphanAdministration([owner, staff], roles, 'u1')).toBe(true);
    expect(wouldOrphanAdministration([owner, staff], roles, 'u2')).toBe(false);
  });

  it('refuses to deactivate them, and says what to do instead', () => {
    expect(validateDeactivation([owner, staff], roles, 'u1', 'Retired'))
      .toMatch(/only active operator who can administer/i);
  });

  it('allows it once a second administrator exists', () => {
    const second = user({ id: 'u3', name: 'Owner Q', roleName: 'Owner', pin: '3333' });
    expect(validateDeactivation([owner, staff, second], roles, 'u1', 'Retired')).toBeNull();
  });

  it('requires a reason', () => {
    expect(validateDeactivation([owner, staff], roles, 'u2', '')).toMatch(/audit trail/i);
  });

  it('refuses to deactivate someone twice', () => {
    const gone = user({ id: 'u2', isActive: false });
    expect(validateDeactivation([owner, gone], roles, 'u2', 'Left')).toMatch(/already deactivated/i);
  });
});

describe('supervisorsFromUsers — closes the M33 seam', () => {
  it('derives the approver roster from real users, not a parallel list', () => {
    const supervisors = supervisorsFromUsers(DEFAULT_USERS, roles);
    expect(supervisors.map(s => s.supervisorName)).toContain('Prathamesh S.');
    expect(supervisors.every(s => s.pin.length >= 4)).toBe(true);
  });

  it('excludes roles that cannot override a price', () => {
    // Counter Staff has billing.discount but not billing.override.
    expect(supervisorsFromUsers(DEFAULT_USERS, roles).map(s => s.supervisorName))
      .not.toContain('Rakesh T.');
  });

  it('WITHDRAWS approval rights when a user is deactivated, in the same action', () => {
    const after = deactivateUser(DEFAULT_USERS, 'usr-manager', 'Left the company');
    expect(supervisorsFromUsers(after, roles).map(s => s.supervisorName)).not.toContain('Sharda M.');
  });

  it('carries the role name through, so the approval log records it', () => {
    const owner = supervisorsFromUsers(DEFAULT_USERS, roles).find(s => s.supervisorName === 'Prathamesh S.');
    expect(owner?.roleName).toBe('Owner');
  });
});

describe('roleOf', () => {
  it('matches by name, case-insensitively', () => {
    expect(roleOf(user({ roleName: 'store manager' }), roles)?.name).toBe('Store Manager');
  });

  it('returns null for an unknown role rather than guessing', () => {
    expect(roleOf(user({ roleName: 'Wizard' }), roles)).toBeNull();
  });
});

describe('upsertUser & blankUser', () => {
  it('adds a new user and updates an existing one', () => {
    const list = [user({ id: 'u1' })];
    expect(upsertUser(list, user({ id: 'u2', pin: '9999' }))).toHaveLength(2);
    expect(upsertUser(list, user({ id: 'u1', name: 'Renamed' }))[0].name).toBe('Renamed');
  });

  it('blanks default to active with the given role', () => {
    const b = blankUser('Counter Staff', 'br-1');
    expect(b).toMatchObject({ roleName: 'Counter Staff', branchId: 'br-1', isActive: true, name: '' });
  });
});

describe('summariseUsers', () => {
  it('counts active, deactivated, administrators and approvers', () => {
    const after = deactivateUser(DEFAULT_USERS, 'usr-counter', 'Left');
    const s = summariseUsers(after, roles);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.deactivated).toBe(1);
    expect(s.approvers).toBe(2);
  });

  it('handles an empty roster', () => {
    expect(summariseUsers([], roles)).toMatchObject({ total: 0, active: 0, administrators: 0 });
  });
});
