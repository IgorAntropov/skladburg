import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';

import {
  create,
  equals,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  GetYardQueuePolicyResponseSchema,
  SaveYardQueuePolicyResponseSchema,
  YardQueuePolicySchema,
  YardQueuePolicyService,
  YardQueueWeightsSchema,
} from '@skladburg/contracts/wms/v1/yard_queue_policy';
import { YardQueuePolicyChangedSchema } from '@skladburg/contracts/wms/v1/yard_queue_policy_events';

import type { EngineRequestHandler } from '../../router/engineRouter';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  createContextFetchHandler,
  createPathDispatcher,
  createServiceRouter,
} from '../../router/engineRouter';
import { reassignOrganizationInboundDocks } from './inboundRecords';
import { DEFAULT_YARD_QUEUE_WEIGHTS } from './yardQueueScoring';

const MAX_POLICY_VERSION = 2_147_483_647n;

export const createYardQueuePolicyService = (runtime: IModuleRuntime): ServiceImpl<typeof YardQueuePolicyService> => {
  const { command, errors, guard, idempotency, outbox, read } = runtime;
  const { method } = YardQueuePolicyService;

  return {
    getYardQueuePolicy: (request, context) => {
      const { organizationId } = guard.guardPermissionCall(read, method.getYardQueuePolicy, request, context.requestHeader);
      const policy = read.get('yardQueuePolicies', organizationId)
        ?? create(YardQueuePolicySchema, { organizationId, weights: DEFAULT_YARD_QUEUE_WEIGHTS });
      return create(GetYardQueuePolicyResponseSchema, { policy });
    },
    saveYardQueuePolicy: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, method.saveYardQueuePolicy, request, context.requestHeader);
      if (caller.admission.kind !== 'membership') {
        throw errors.permissionDenied('yard_manage');
      }
      const { organizationId } = caller;
      return idempotency.run(transaction, {
        handler: () => {
          const current = transaction.get('yardQueuePolicies', organizationId)
            ?? create(YardQueuePolicySchema, { organizationId, weights: DEFAULT_YARD_QUEUE_WEIGHTS });
          if (request.expectedVersion !== current.version) {
            throw errors.versionConflict(EntityKind.ORGANIZATION, Number(current.version));
          }
          if (current.weights !== undefined && request.weights !== undefined
            && equals(YardQueueWeightsSchema, current.weights, request.weights)) {
            return create(SaveYardQueuePolicyResponseSchema, { policy: current });
          }
          if (current.version >= MAX_POLICY_VERSION) {
            throw errors.unavailable();
          }

          const policy = create(YardQueuePolicySchema, { organizationId, version: current.version + 1n, weights: request.weights });
          transaction.put('yardQueuePolicies', policy);
          reassignOrganizationInboundDocks(transaction, runtime, organizationId);
          outbox.add(transaction, organizationChannel(organizationId), {
            case: 'yardQueuePolicyChanged',
            value: create(YardQueuePolicyChangedSchema, { organizationId }),
          });
          return create(SaveYardQueuePolicyResponseSchema, { policy });
        },
        idempotencyKey: request.idempotencyKey,
        method: method.saveYardQueuePolicy,
        request,
        scope: organizationId,
      });
    }),
  };
};

export const createYardQueuePolicyHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  const router = createServiceRouter(runtime.errors, supportAudit);
  router.service(YardQueuePolicyService, createYardQueuePolicyService(runtime));
  return createContextFetchHandler(createPathDispatcher(router.handlers));
};
