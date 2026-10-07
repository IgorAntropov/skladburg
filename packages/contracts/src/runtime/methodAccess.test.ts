import {
  describe,
  expect,
  it,
} from 'vitest';

import { OrganizationService } from '../gen/organization/v1/organization_pb';
import { getMethodAccess } from './methodAccess';

const findMethod = (name: string): (typeof OrganizationService.methods)[number] => {
  const method = OrganizationService.methods.find(candidate => candidate.name === name);

  if (!method) {
    throw new Error(`Method ${name} is not declared`);
  }

  return method;
};

describe('getMethodAccess', () => {
  it('reads a permission requirement', () => {
    const requirement = getMethodAccess(findMethod('ListWarehouses'))?.requirement;

    expect(requirement?.case).toBe('permission');
    expect(requirement?.case === 'permission' ? requirement.value.name : undefined).toBe('warehouse_view');
  });

  it('reads a member requirement', () => {
    expect(getMethodAccess(findMethod('GetOrganization'))?.requirement.case).toBe('member');
  });

  it('reads a session requirement', () => {
    expect(getMethodAccess(findMethod('ListSpheres'))?.requirement.case).toBe('session');
  });

  it('returns a requirement for every method of the service', () => {
    const methodsWithoutAccess = OrganizationService.methods.filter(method => getMethodAccess(method) === undefined);

    expect(methodsWithoutAccess).toEqual([]);
  });
});
