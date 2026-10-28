import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { timestampMs } from '@bufbuild/protobuf/wkt';

import type { IRandom } from '../../ports/index';
import type { IStateReader } from '../../state/index';

import { resolveEffectivePermissions } from '../../access/index';
import { compareIds } from '../../state/index';
import { SUPPORT_ACCESS_APPROVE_PERMISSION } from './supportAccessRules';

const SEQUENCE_DIGITS = 8;
const SEQUENCE_RADIX = 16;
const RANDOM_PART_START = 8;

export const readTimestampMs = (timestamp: Timestamp | undefined): number =>
  timestamp === undefined ? 0 : timestampMs(timestamp);

export const createSequencedId = (random: IRandom, writtenCount: number): string =>
  `${(writtenCount + 1).toString(SEQUENCE_RADIX).padStart(SEQUENCE_DIGITS, '0')}${random.uuid().slice(RANDOM_PART_START)}`;

export const compareNewestFirst = (
  current: { id: string; time: Timestamp | undefined },
  prev: { id: string; time: Timestamp | undefined },
): number => readTimestampMs(prev.time) - readTimestampMs(current.time) || compareIds(prev.id, current.id);

export const countSupportAccessSessions = (reader: IStateReader): number => reader.list('supportAccessSessions').length;

export const listOrganizationSessions = (reader: IStateReader, organizationId: string): SupportAccessSession[] =>
  reader.listBy('supportAccessSessions', 'organizationId', organizationId)
    .sort((current, prev) => compareNewestFirst(
      { id: current.id, time: current.requestedAt },
      { id: prev.id, time: prev.requestedAt },
    ));

export const listSupportAccessApprovers = (reader: IStateReader, organizationId: string): string[] =>
  reader.listBy('memberships', 'organizationId', organizationId)
    .filter(membership => resolveEffectivePermissions(reader, membership).some(
      effective => effective.permission === SUPPORT_ACCESS_APPROVE_PERMISSION && effective.isOrganizationWide,
    ))
    .map(membership => membership.userId)
    .sort(compareIds);
