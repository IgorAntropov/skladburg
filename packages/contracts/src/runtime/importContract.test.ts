import {
  describe,
  expect,
  it,
} from 'vitest';

import { PermissionCode } from '../gen/access/v1/permission_pb';
import { ImportService } from '../gen/import/v1/import_pb';
import { getMethodAccess } from './methodAccess';
import { getPermissionTraits } from './permissionCatalog';

describe('import contract', () => {
  it('declares six guarded methods and permissions for all profiles', () => {
    expect(ImportService.methods).toHaveLength(6);
    expect(ImportService.methods.every(method => getMethodAccess(method)?.requirement.case === 'permission')).toBe(true);
    expect(getPermissionTraits(PermissionCode.IMPORT_VIEW).profiles).toHaveLength(3);
    expect(getPermissionTraits(PermissionCode.IMPORT_CREATE).profiles).toHaveLength(3);
  });
});
