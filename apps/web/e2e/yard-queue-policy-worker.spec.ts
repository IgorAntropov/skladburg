import type {
  GetYardQueuePolicyResponse,
  YardQueueWeights,
} from '@skladburg/contracts/wms/v1/yard_queue_policy';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  GetYardQueuePolicyRequestSchema,
  GetYardQueuePolicyResponseSchema,
  SaveYardQueuePolicyRequestSchema,
  SaveYardQueuePolicyResponseSchema,
  YardQueuePolicyService,
} from '@skladburg/contracts/wms/v1/yard_queue_policy';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const SEED_REQUEST = '**/assets/seedSnapshot-*.js';
const ZERO_WEIGHTS = {
  cargoUrgencyWeight: 0,
  deliveryWindowWeight: 0,
  explicitUrgencyWeight: 0,
  resourceAvailabilityWeight: 0,
  waitingTimeWeight: 0,
} satisfies Omit<Required<YardQueueWeights>, '$typeName' | '$unknown'>;

const readPolicy = async (worker: EngineWorkerRobotValue): Promise<GetYardQueuePolicyResponse> =>
  fromBinary(GetYardQueuePolicyResponseSchema, await worker.call(`${YardQueuePolicyService.typeName}/GetYardQueuePolicy`,
    toBinary(GetYardQueuePolicyRequestSchema, create(GetYardQueuePolicyRequestSchema)),
  ));

test('saves explicit zero yard weights and restores the policy after restarting the production Worker', async ({ page }) => {
  const worker = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  let saved: GetYardQueuePolicyResponse['policy'];
  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const { policy } = await readPolicy(worker);
    expect(policy).toMatchObject({
      organizationId: DEAL_CUSTOMER.organizationId,
      version: 0n,
      weights: {
        cargoUrgencyWeight: 55,
        deliveryWindowWeight: 25,
        explicitUrgencyWeight: 100,
        resourceAvailabilityWeight: 5,
        waitingTimeWeight: 10,
      },
    });

    const request = create(SaveYardQueuePolicyRequestSchema, {
      expectedVersion: 0n, idempotencyKey: randomUUID(), weights: ZERO_WEIGHTS,
    });
    saved = fromBinary(SaveYardQueuePolicyResponseSchema, await worker.call(`${YardQueuePolicyService.typeName}/SaveYardQueuePolicy`,
      toBinary(SaveYardQueuePolicyRequestSchema, request),
    )).policy;
    expect(saved).toMatchObject({ organizationId: DEAL_CUSTOMER.organizationId, version: 1n, weights: ZERO_WEIGHTS });
  }
  finally {
    await worker.stop();
  }

  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  const restored = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect((await readPolicy(restored)).policy).toEqual(saved);
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(false);
  }
  finally {
    await restored.stop();
  }
});
