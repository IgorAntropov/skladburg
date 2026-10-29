import { create } from '@bufbuild/protobuf';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../../platform/index';
import {
  createSeedSnapshot,
  SeedMembershipId,
  SeedUserId,
} from '../../seed/index';
import {
  createEngineState,
  type IEngineState,
} from '../../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../../state/testRecords';
import { findSupportResponderName } from './supportTicketRecords';

const createSeedState = (): IEngineState => createEngineState(createSeedSnapshot());

const deleteMembership = (state: IEngineState, membershipId: string): void => {
  state.transact(TEST_WORLD_TIME_MS, (transaction) => {
    transaction.delete('memberships', membershipId);
  }, createLiveMeta).apply();
};

describe('findSupportResponderName', () => {
  it('names the support agent, the smallest user id among the operator members who may reply', () => {
    expect(findSupportResponderName(createSeedState().read)).toBe('Ксения Р.');
  });

  it('moves to the next smallest user id when the first responder has left', () => {
    const state = createSeedState();
    deleteMembership(state, SeedMembershipId.OPERATOR_SUPPORT_AGENT);

    const name = findSupportResponderName(state.read);
    const engineer = state.read.get('users', SeedUserId.OPERATOR_SUPPORT_ENGINEER);

    expect(name).not.toBe('');
    expect(name).toBe(engineer?.displayName);
  });

  it('skips operator members whose roles carry no reply permission', () => {
    const state = createSeedState();
    deleteMembership(state, SeedMembershipId.OPERATOR_SUPPORT_AGENT);
    deleteMembership(state, SeedMembershipId.OPERATOR_SUPPORT_ENGINEER);
    deleteMembership(state, SeedMembershipId.OPERATOR_SUPER_ADMIN_1);
    deleteMembership(state, SeedMembershipId.OPERATOR_SUPER_ADMIN_2);

    expect(state.read.listBy('memberships', 'organizationId', PLATFORM_OPERATOR_ORGANIZATION_ID)).toHaveLength(1);
    expect(findSupportResponderName(state.read)).toBe('');
  });

  it('is empty when the operator has no members at all', () => {
    const state = createSeedState();

    for (const membership of state.read.listBy('memberships', 'organizationId', PLATFORM_OPERATOR_ORGANIZATION_ID)) {
      deleteMembership(state, membership.id);
    }

    expect(findSupportResponderName(state.read)).toBe('');
  });

  it('does not take a client member with a support permission in a role', () => {
    const state = createSeedState();

    state.transact(TEST_WORLD_TIME_MS, (transaction) => {
      transaction.put('memberships', create(MembershipSchema, {
        id: 'c0000000-0000-4000-8000-0000000000aa',
        organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID,
        roleAssignments: [],
        userId: SeedUserId.ADMIN_1,
      }));
    }, createLiveMeta).apply();
    for (const membershipId of [
      SeedMembershipId.OPERATOR_SUPPORT_AGENT,
      SeedMembershipId.OPERATOR_SUPPORT_ENGINEER,
      SeedMembershipId.OPERATOR_SUPER_ADMIN_1,
      SeedMembershipId.OPERATOR_SUPER_ADMIN_2,
    ]) {
      deleteMembership(state, membershipId);
    }

    expect(findSupportResponderName(state.read)).toBe('');
  });
});
