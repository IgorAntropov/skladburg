import type {
  ConnectError,
  Interceptor,
  StreamRequest,
  UnaryRequest,
} from '@connectrpc/connect';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { MethodOptions_IdempotencyLevel } from '@bufbuild/protobuf/wkt';
import { ErrorDetailSchema } from '@skladburg/contracts/common/v1/error';
import { getMethodAccess } from '@skladburg/contracts/runtime';
import {
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';

import type { ActingContextValue } from '../context/index';
import type { IModuleRuntime } from '../modules/index';
import type { IStateReader } from '../state/index';

import { readActingContext } from '../context/index';
import { appendSupportAuditEntry } from '../modules/index';

export type SupportAuditDependenciesValue = Pick<IModuleRuntime, 'command' | 'errors' | 'random' | 'read'>;

interface AuditedCallValue {
  permission: string | undefined;
  session: SupportAccessSession;
}

type AuditedRequestValue = StreamRequest | UnaryRequest;

const isStaffSessionOfOrganization = (context: ActingContextValue, session: SupportAccessSession): boolean =>
  session.staffUserId === context.userId && session.organizationId === context.organizationId;

const resolveAuditedCall = (reader: IStateReader, request: AuditedRequestValue): AuditedCallValue | undefined => {
  const context = readActingContext(request.header);
  const session = context.supportSessionId === undefined
    ? undefined
    : reader.get('supportAccessSessions', context.supportSessionId);

  if (session === undefined || !isStaffSessionOfOrganization(context, session)) {
    return undefined;
  }

  const requirement = getMethodAccess(request.method)?.requirement;

  if (requirement?.case === 'permission') {
    return { permission: requirement.value.name, session };
  }

  return requirement?.case === 'member' ? { permission: undefined, session } : undefined;
};

export const createSupportAuditInterceptor = (dependencies: SupportAuditDependenciesValue): Interceptor => {
  const { command, errors, random, read } = dependencies;

  const record = async (
    audited: AuditedCallValue,
    request: AuditedRequestValue,
    failure: ConnectError | undefined,
  ): Promise<void> => {
    try {
      await command(transaction => appendSupportAuditEntry(transaction, random, {
        action: request.method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS
          ? SupportAuditAction.READ
          : SupportAuditAction.CHANGE,
        actorUserId: audited.session.staffUserId,
        errorCode: failure?.findDetails(ErrorDetailSchema)[0]?.code,
        method: `${request.service.typeName}/${request.method.name}`,
        outcome: failure === undefined ? SupportAuditOutcome.ALLOWED : SupportAuditOutcome.DENIED,
        permission: audited.permission,
        session: audited.session,
      }));
    }
    catch (error) {
      throw errors.from(error);
    }
  };

  return next => async (request) => {
    const audited = resolveAuditedCall(read, request);

    if (audited === undefined) {
      return next(request);
    }

    let response: Awaited<ReturnType<typeof next>>;

    try {
      response = await next(request);
    }
    catch (error) {
      const failure = errors.from(error);
      await record(audited, request, failure);

      throw failure;
    }

    await record(audited, request, undefined);

    return response;
  };
};
