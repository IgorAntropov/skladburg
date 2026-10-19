import { create } from '@bufbuild/protobuf';
import {
  type Permission,
  PermissionSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  getPermissionName,
  getPermissionTraits,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';

import { splitPermissionName } from '../../access/index';

export const buildPermissionCatalog = (): Permission[] =>
  listPermissionCodes().map((code) => {
    const name = getPermissionName(code);
    const traits = getPermissionTraits(code);

    return create(PermissionSchema, {
      ...splitPermissionName(name),
      isLimitApplicable: traits.isLimitApplicable,
      isScopeApplicable: traits.isScopeApplicable,
      name,
      profiles: [...traits.profiles],
    });
  });
