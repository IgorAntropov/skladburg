import {
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';

import {
  PermissionCode,
  PermissionCodeSchema,
} from '../gen/access/v1/permission_pb';
import { ProfileKind } from '../gen/organization/v1/organization_pb';
import { compareCodeUnits } from './compareCodeUnits';
import { getPermissionTraits } from './permissionCatalog';
import {
  findPermissionCode,
  getPermissionName,
  listPermissionCodes,
  type PermissionNameValue,
} from './permissionCodeNames';

const NAME_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*_(view|create|edit|delete|approve|sign|fund|release|export|manage)$/;

describe('permission code names', () => {
  it('names a code in lower case without the enum prefix', () => {
    expect(getPermissionName(PermissionCode.DEAL_APPROVE)).toBe('deal_approve');
    expect(getPermissionName(PermissionCode.TRANSPORT_OFFER_APPROVE)).toBe('transport_offer_approve');
  });

  it('narrows the name to a literal of the declared permissions', () => {
    expectTypeOf(getPermissionName(PermissionCode.DEAL_APPROVE)).toEqualTypeOf<PermissionNameValue>();
    expectTypeOf<'deal_approve'>().toExtend<PermissionNameValue>();
    expectTypeOf<'unspecified'>().not.toExtend<PermissionNameValue>();
    expectTypeOf<string>().not.toExtend<PermissionNameValue>();
  });

  it('finds a code by its name', () => {
    expect(findPermissionCode('warehouse_view')).toBe(PermissionCode.WAREHOUSE_VIEW);
  });

  it.each(['', 'unspecified', 'warehouse_hide', 'WAREHOUSE_VIEW', 'permission_code_deal_view'])(
    'finds nothing by the name "%s"',
    (name) => {
      expect(findPermissionCode(name)).toBeUndefined();
    },
  );

  it('keeps the enum names in step with the proto value names', () => {
    const protoNames = PermissionCodeSchema.values
      .filter(value => value.name !== 'PERMISSION_CODE_UNSPECIFIED')
      .map(value => value.name.replace('PERMISSION_CODE_', '').toLowerCase())
      .sort(compareCodeUnits);

    expect(protoNames).toEqual(listPermissionCodes().map(getPermissionName));
  });

  it('round-trips every listed code through its name', () => {
    const roundTripped = listPermissionCodes().map(code => findPermissionCode(getPermissionName(code)));

    expect(roundTripped).toEqual(listPermissionCodes());
  });
});

describe('listPermissionCodes', () => {
  it('lists the fifty nine codes of the catalog without the unspecified one', () => {
    const codes = listPermissionCodes();

    expect(codes).toHaveLength(59);
    expect(codes).not.toContain(PermissionCode.UNSPECIFIED);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('sorts the codes by name in code units', () => {
    const names = listPermissionCodes().map(getPermissionName);

    expect([...names].sort(compareCodeUnits)).toEqual(names);
  });

  it('returns a fresh list on every call', () => {
    const codes = listPermissionCodes();

    codes.pop();

    expect(listPermissionCodes()).toHaveLength(59);
  });

  it('gives every code a name made of a feature and an action', () => {
    const invalidNames = listPermissionCodes().map(getPermissionName).filter(name => !NAME_PATTERN.test(name));

    expect(invalidNames).toEqual([]);
  });
});

describe('getPermissionTraits', () => {
  it('reads the profiles of a code', () => {
    expect(getPermissionTraits(PermissionCode.ORGANIZATION_EDIT).profiles).toEqual([
      ProfileKind.CUSTOMER,
      ProfileKind.SUPPLIER,
      ProfileKind.CARRIER,
    ]);
    expect(getPermissionTraits(PermissionCode.MARKETPLACE_VIEW).profiles).toEqual([ProfileKind.CUSTOMER]);
    expect(getPermissionTraits(PermissionCode.FLEET_EDIT).profiles).toEqual([ProfileKind.CARRIER]);
  });

  it('marks the scope of warehouse rights', () => {
    expect(getPermissionTraits(PermissionCode.WAREHOUSE_VIEW).isScopeApplicable).toBe(true);
    expect(getPermissionTraits(PermissionCode.WAREHOUSE_CREATE).isScopeApplicable).toBe(false);
    expect(getPermissionTraits(PermissionCode.DEAL_VIEW).isScopeApplicable).toBe(false);
  });

  it('marks the limit of money rights', () => {
    expect(getPermissionTraits(PermissionCode.DEAL_APPROVE).isLimitApplicable).toBe(true);
    expect(getPermissionTraits(PermissionCode.PAYMENT_RELEASE).isLimitApplicable).toBe(true);
    expect(getPermissionTraits(PermissionCode.WAREHOUSE_VIEW).isLimitApplicable).toBe(false);
  });

  it('gives every code at least one profile', () => {
    const codesWithoutProfile = listPermissionCodes().filter(code => getPermissionTraits(code).profiles.length === 0);

    expect(codesWithoutProfile).toEqual([]);
  });

  it('refuses the unspecified code', () => {
    expect(() => getPermissionTraits(PermissionCode.UNSPECIFIED)).toThrow();
  });
});
