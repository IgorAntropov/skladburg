import type {
  YardQueuePolicy,
  YardQueueWeights,
} from '@skladburg/contracts/wms/v1/yard_queue_policy';
import type { UseQueryResult } from '@tanstack/react-query';

import { YardQueueWeightsFormRules } from '@skladburg/contracts/forms/wms/v1/yard_queue_policy';
import { YardQueuePolicyService } from '@skladburg/contracts/wms/v1/yard_queue_policy';
import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import { useWarehouseCommandAttempt } from './useWarehouseCommands';

type YardWeightFormValue<T> = Record<YardWeightNameValue, T>;
type YardWeightNameValue = keyof typeof YardQueueWeightsFormRules.fields;

const fields = YardQueueWeightsFormRules.fields;
const weightRules = {
  fields: {
    cargoUrgencyWeight: { ...fields.cargoUrgencyWeight, gte: 0 },
    deliveryWindowWeight: { ...fields.deliveryWindowWeight, gte: 0 },
    explicitUrgencyWeight: { ...fields.explicitUrgencyWeight, gte: 0 },
    resourceAvailabilityWeight: { ...fields.resourceAvailabilityWeight, gte: 0 },
    waitingTimeWeight: { ...fields.waitingTimeWeight, gte: 0 },
  },
};

const policyKey = (organizationId: string | undefined, userId: string | undefined): readonly (string | undefined)[] =>
  ['yard-queue-policy', organizationId, userId];

const mapViolationPath = (path: string): string => path.replace(/^weights\./u, '');

export const useYardQueuePolicy = (): UseQueryResult<YardQueuePolicy> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const canRead = organizationId !== undefined && userId !== undefined;
  return useQuery({
    meta: createOrganizationQueryMeta(canRead ? organizationId : undefined, ['yardQueuePolicyChanged']),
    queryFn: canRead
      ? async ({ signal }) => {
        const { policy } = await client.service(YardQueuePolicyService).getYardQueuePolicy({}, { signal });
        if (policy?.organizationId !== organizationId || policy.weights === undefined) {
          throw new Error('Missing yard queue policy');
        }
        return policy;
      }
      : skipToken,
    queryKey: policyKey(organizationId, userId),
  });
};

export const useYardQueuePolicyForm = (
  version: bigint,
  weights: YardQueueWeights,
  onSave: (policy: YardQueuePolicy) => void,
): CommandFormValue<YardWeightFormValue<string>> => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();
  const attempt = useWarehouseCommandAttempt<YardQueuePolicy>();
  return useCommandForm<YardWeightFormValue<string>, YardQueuePolicy, YardWeightFormValue<number>>({
    defaultValues: {
      cargoUrgencyWeight: String(weights.cargoUrgencyWeight ?? ''),
      deliveryWindowWeight: String(weights.deliveryWindowWeight ?? ''),
      explicitUrgencyWeight: String(weights.explicitUrgencyWeight ?? ''),
      resourceAvailabilityWeight: String(weights.resourceAvailabilityWeight ?? ''),
      waitingTimeWeight: String(weights.waitingTimeWeight ?? ''),
    },
    execute: (values, idempotencyKey) => attempt(idempotencyKey, async () => {
      const { policy } = await client.service(YardQueuePolicyService).saveYardQueuePolicy({
        expectedVersion: version, idempotencyKey, weights: values,
      });
      if (policy === undefined || policy.organizationId !== organizationId || policy.weights === undefined) {
        throw new Error('Missing saved yard queue policy');
      }
      return policy;
    }),
    mapViolationPath,
    method: YardQueuePolicyService.method.saveYardQueuePolicy,
    onSuccess: (policy) => {
      void queryClient.invalidateQueries({ queryKey: policyKey(organizationId, userId) });
      onSave(policy);
    },
    rules: weightRules,
  });
};
