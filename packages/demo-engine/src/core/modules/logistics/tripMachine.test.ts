import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../../errors/index';
import { createSeededRandom } from '../../ports/index';
import { captureFailure } from '../catalog/testing/catalogFixtures';
import {
  requireTripTransition,
  type TripCommand,
} from './tripMachine';

const statuses = Object.values(TripStatus).filter(status => typeof status === 'number');
const expectedRows = [
  { command: 'accept', from: TripStatus.ARRIVED, to: TripStatus.DELIVERED },
  { command: 'arrive', from: TripStatus.IN_TRANSIT, to: TripStatus.ARRIVED },
  { command: 'assign', from: TripStatus.ASSIGNED, to: TripStatus.ASSIGNED },
  { command: 'assign', from: TripStatus.CONFIRMED, to: TripStatus.ASSIGNED },
  { command: 'cancel', from: TripStatus.ASSIGNED, to: TripStatus.CANCELLED },
  { command: 'cancel', from: TripStatus.AWAITING_CONFIRMATION, to: TripStatus.CANCELLED },
  { command: 'cancel', from: TripStatus.CONFIRMED, to: TripStatus.CANCELLED },
  { command: 'close', from: TripStatus.DELIVERED, to: TripStatus.CLOSED },
  { command: 'confirm', from: TripStatus.AWAITING_CONFIRMATION, to: TripStatus.CONFIRMED },
  { command: 'depart', from: TripStatus.LOADED, to: TripStatus.IN_TRANSIT },
  { command: 'load', from: TripStatus.ASSIGNED, to: TripStatus.LOADED },
] satisfies { command: TripCommand; from: TripStatus; to: TripStatus }[];
const commands = [...new Set(expectedRows.map(row => row.command))];

const errors = createDomainErrors(createSeededRandom(1));

describe('trip state machine', () => {
  it.each(commands.flatMap(command => statuses.map(status => ({ command, status }))))(
    'resolves only the table row $command from $status', async ({ command, status }) => {
      const expected = expectedRows.find(row => row.command === command && row.from === status);
      if (expected === undefined) {
        const failure = await captureFailure(Promise.resolve().then(() =>
          requireTripTransition(errors, command, { status, version: 1 }, 1)));
        expect(failure.code).toBe(ErrorCode.INVALID_TRANSITION);
      }
      else {
        expect(requireTripTransition(errors, command, { status, version: 1 }, 1)).toEqual({ status: expected.to });
      }
    },
  );
});
