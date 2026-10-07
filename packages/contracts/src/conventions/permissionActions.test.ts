import {
  getOption,
  hasOption,
} from '@bufbuild/protobuf';
import { field as fieldRules } from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { loadContractRegistry } from './loadContractRegistry';
import { listPermissionActions } from './permissionActions';
import { contractImagePath } from './syntheticContract';

const ACTIONS_GROUP_PATTERN = /_\(([a-z|]+)\)\$$/;

const readPermissionNamePattern = (): string => {
  const nameField = loadContractRegistry(contractImagePath)
    .getMessage('common.v1.PermissionRequirement')
    ?.fields.find(field => field.name === 'name');

  if (!nameField || !hasOption(nameField, fieldRules)) {
    throw new Error('PermissionRequirement.name has no validation rules');
  }

  const { type } = getOption(nameField, fieldRules);

  if (type.case !== 'string') {
    throw new Error('PermissionRequirement.name is not a string rule');
  }

  return type.value.pattern;
};

const readPatternActions = (pattern: string): string[] => {
  const actions = ACTIONS_GROUP_PATTERN.exec(pattern)?.[1];

  return actions === undefined ? [] : actions.split('|');
};

describe('permission actions', () => {
  it('lists the actions of the PermissionAction enum in lower case without the unspecified value', () => {
    expect(listPermissionActions()).toEqual([
      'view',
      'create',
      'edit',
      'delete',
      'approve',
      'sign',
      'fund',
      'release',
      'export',
      'manage',
    ]);
  });

  it('matches the actions in the permission name pattern', () => {
    const patternActions = readPatternActions(readPermissionNamePattern());

    expect([...patternActions].sort()).toEqual([...listPermissionActions()].sort());
  });

  it('extracts nothing from a pattern without an action group', () => {
    expect(readPatternActions('^[a-z]+$')).toEqual([]);
  });
});
