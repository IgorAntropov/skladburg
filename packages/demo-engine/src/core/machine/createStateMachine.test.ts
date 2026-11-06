import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import { createStateMachine } from './createStateMachine';

type CommandValue = 'approve' | 'cancel';
type StatusValue = 'active' | 'cancelled' | 'draft';

interface TransitionValue {
  status: StatusValue;
}

const machine = createStateMachine<CommandValue, StatusValue, TransitionValue>({
  entity: EntityKind.SUPPORT_ACCESS_SESSION,
  intendedStatuses: { approve: 'active', cancel: 'cancelled' },
  statusName: status => status,
  transitions: {
    approve: { draft: { status: 'active' } },
    cancel: { active: { status: 'cancelled' }, draft: { status: 'cancelled' } },
  },
});

const errors = createDomainErrors(createSeededRandom(17));

describe('createStateMachine', () => {
  it.each([
    ['approve', 'draft', 'active'],
    ['cancel', 'draft', 'cancelled'],
    ['cancel', 'active', 'cancelled'],
  ] satisfies [CommandValue, StatusValue, StatusValue][])('resolves %s from %s to %s', (command, status, expected) => {
    const current = { status, version: 3 };

    expect(machine.findTransition(command, status)).toEqual({ status: expected });
    expect(machine.requireTransition(errors, command, current, 3)).toEqual({ status: expected });
    expect(current).toEqual({ status, version: 3 });
  });

  it.each([
    ['approve', 'active'],
    ['approve', 'cancelled'],
    ['cancel', 'cancelled'],
  ] satisfies [CommandValue, StatusValue][])('rejects %s from %s', (command, status) => {
    expect(machine.findTransition(command, status)).toBeUndefined();

    try {
      machine.requireTransition(errors, command, { status, version: 3 }, 3);
      expect.fail('Expected invalid transition');
    }
    catch (error) {
      expect(errors.from(error).findDetails(ErrorDetailSchema)[0]).toMatchObject({
        code: ErrorCode.INVALID_TRANSITION,
        params: { case: 'invalidTransition', value: { entity: EntityKind.SUPPORT_ACCESS_SESSION, fromStatus: status } },
      });
    }
  });

  it('checks the version before the transition and reports the current version', () => {
    try {
      machine.requireTransition(errors, 'approve', { status: 'cancelled', version: 3 }, 2);
      expect.fail('Expected version conflict');
    }
    catch (error) {
      expect(errors.from(error).findDetails(ErrorDetailSchema)[0]).toMatchObject({
        code: ErrorCode.VERSION_CONFLICT,
        params: { case: 'versionConflict', value: { currentVersion: 3, entity: EntityKind.SUPPORT_ACCESS_SESSION } },
      });
    }
  });

  it('allows internal transitions without an expected version', () => {
    expect(machine.requireTransition(errors, 'cancel', { status: 'active', version: 7 }, undefined)).toEqual({ status: 'cancelled' });
  });
});
