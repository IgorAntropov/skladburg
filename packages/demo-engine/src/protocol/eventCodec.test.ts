import { create } from '@bufbuild/protobuf';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  expect,
  it,
} from 'vitest';

import { decodeEvent } from './decodeEvent';
import { encodeEvent } from './eventCodec';

it('preserves a receiving task notification when its event buffer is transferred', () => {
  const warehouseId = '64f40000-0000-4000-8000-000000000001';
  const event = create(EventSchema, {
    channel: tasksChannel(warehouseId),
    epoch: 'epoch-1',
    payload: { case: 'receivingTasksChanged', value: { warehouseId } },
    seq: 9_007_199_254_740_993n,
  });
  const buffer = encodeEvent(event);
  const transferred = structuredClone(buffer, { transfer: [buffer] });

  expect(decodeEvent(transferred)).toMatchObject({
    channel: 'tasks:64f40000-0000-4000-8000-000000000001',
    epoch: 'epoch-1',
    payload: { case: 'receivingTasksChanged', value: { warehouseId } },
    seq: 9_007_199_254_740_993n,
  });
});
