import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { ServiceImpl } from '@connectrpc/connect';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ApproveSupportAccessResponseSchema,
  CloseSupportAccessResponseSchema,
  DeclineSupportAccessResponseSchema,
  EndSupportAccessResponseSchema,
  ListSupportAccessSessionsResponseSchema,
  ListSupportAuditEntriesResponseSchema,
  RequestSupportAccessResponseSchema,
  StartEmergencySupportAccessResponseSchema,
  SupportAccessKind,
  SupportAccessMode,
  SupportAccessService,
  SupportAccessSessionSchema,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
  SupportEmergencyReview,
} from '@skladburg/contracts/support/v1/support_access';
import { SupportAccessChange } from '@skladburg/contracts/support/v1/support_events';

import type {
  AdmittedCallerValue,
  CallerValue,
} from '../../access/index';
import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { isPlatformOperator } from '../../platform/index';
import { paginate } from '../pagination';
import { SupportAccessCommand } from './supportAccessMachine';
import { postSupportAccessNotice } from './supportAccessNotices';
import {
  countSupportAccessSessions,
  createSequencedId,
  listOrganizationSessions,
} from './supportAccessRecords';
import {
  MINUTE_MS,
  SUPPORT_EMERGENCY_MANAGE_PERMISSION,
  SUPPORT_SETTINGS_EDIT_PERMISSION,
} from './supportAccessRules';
import { createSupportAccessTransitioner } from './supportAccessTransition';
import {
  appendSupportAuditEntry,
  listSupportAuditEntries,
} from './supportAuditRecords';

interface ClientTransitionOptionsValue<TInput extends DescMessage, TOutput extends DescMessage> {
  command: SupportAccessCommand;
  headers: Headers;
  method: DescMethodUnary<TInput, TOutput>;
  request: ClientTransitionRequestValue<TInput>;
  toResponse: (session: SupportAccessSession) => MessageShape<TOutput>;
}

type ClientTransitionRequestValue<TInput extends DescMessage> = MessageShape<TInput> & {
  expectedVersion: number;
  idempotencyKey: string;
  sessionId: string;
};

interface SessionTargetRequestValue {
  mode: SupportAccessMode;
  organizationId: string;
  ticketId: string;
}

interface SessionTargetValue {
  ticketNumber: number;
}

export const createSupportAccessService = (runtime: IModuleRuntime): ServiceImpl<typeof SupportAccessService> => {
  const {
    command,
    errors,
    guard,
    idempotency,
    random,
    read,
  } = runtime;
  const transitioner = createSupportAccessTransitioner(runtime);

  const hasPermission = (caller: CallerValue, name: string): boolean =>
    caller.permissions.some(effective => effective.permission === name);

  const resolveScope = (caller: CallerValue): string => [caller.user.id, caller.organizationId].join(':');

  const resolveSessionTarget = (
    reader: IStateReader,
    caller: CallerValue,
    request: SessionTargetRequestValue,
  ): SessionTargetValue => {
    if (isPlatformOperator(request.organizationId) || reader.get('organizations', request.organizationId) === undefined) {
      throw errors.notFound(EntityKind.ORGANIZATION);
    }

    const ticket = request.ticketId === '' ? undefined : reader.get('supportTickets', request.ticketId);

    if (request.ticketId !== '' && ticket?.organizationId !== request.organizationId) {
      throw errors.notFound(EntityKind.SUPPORT_TICKET);
    }

    if (request.mode === SupportAccessMode.EDIT && !hasPermission(caller, SUPPORT_SETTINGS_EDIT_PERMISSION)) {
      throw errors.permissionDenied(SUPPORT_SETTINGS_EDIT_PERMISSION);
    }

    return { ticketNumber: ticket?.number ?? 0 };
  };

  const findOrganizationSession = (reader: IStateReader, caller: AdmittedCallerValue, sessionId: string): SupportAccessSession => {
    const session = reader.get('supportAccessSessions', sessionId);

    if (session?.organizationId !== caller.organizationId) {
      throw errors.notFound(EntityKind.SUPPORT_ACCESS_SESSION);
    }

    return session;
  };

  const runClientTransition = <TInput extends DescMessage, TOutput extends DescMessage>(
    options: ClientTransitionOptionsValue<TInput, TOutput>,
  ): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
    const { command: supportCommand, headers, method, request, toResponse } = options;
    const caller = guard.guardPermissionCall(transaction, method, request, headers);

    return idempotency.run(transaction, {
      handler: () => toResponse(transitioner.apply(transaction, {
        actorUserId: caller.user.id,
        command: supportCommand,
        expectedVersion: request.expectedVersion,
        session: findOrganizationSession(transaction, caller, request.sessionId),
      })),
      idempotencyKey: request.idempotencyKey,
      method,
      request,
      scope: resolveScope(caller),
    });
  });

  return {
    approveSupportAccess: (request, context) => runClientTransition({
      command: SupportAccessCommand.APPROVE,
      headers: context.requestHeader,
      method: SupportAccessService.method.approveSupportAccess,
      request,
      toResponse: session => create(ApproveSupportAccessResponseSchema, { session }),
    }),
    closeSupportAccess: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, SupportAccessService.method.closeSupportAccess, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const found = transaction.get('supportAccessSessions', request.sessionId);

          if (found === undefined) {
            throw errors.notFound(EntityKind.SUPPORT_ACCESS_SESSION);
          }

          const isOwn = found.staffUserId === caller.user.id;

          if (!isOwn && !hasPermission(caller, SUPPORT_EMERGENCY_MANAGE_PERMISSION)) {
            throw errors.permissionDenied(SUPPORT_EMERGENCY_MANAGE_PERMISSION);
          }

          const session = transitioner.apply(transaction, {
            actorUserId: caller.user.id,
            command: isOwn ? SupportAccessCommand.CLOSE_BY_SUPPORT : SupportAccessCommand.CLOSE_BY_SUPER_ADMIN,
            expectedVersion: request.expectedVersion,
            session: found,
          });

          return create(CloseSupportAccessResponseSchema, { session });
        },
        idempotencyKey: request.idempotencyKey,
        method: SupportAccessService.method.closeSupportAccess,
        request,
        scope: resolveScope(caller),
      });
    }),
    declineSupportAccess: (request, context) => runClientTransition({
      command: SupportAccessCommand.DECLINE,
      headers: context.requestHeader,
      method: SupportAccessService.method.declineSupportAccess,
      request,
      toResponse: session => create(DeclineSupportAccessResponseSchema, { session }),
    }),
    endSupportAccess: (request, context) => runClientTransition({
      command: SupportAccessCommand.END,
      headers: context.requestHeader,
      method: SupportAccessService.method.endSupportAccess,
      request,
      toResponse: session => create(EndSupportAccessResponseSchema, { session }),
    }),
    listSupportAccessSessions: (request, context) => {
      const caller = guard.guardPermissionCall(
        read,
        SupportAccessService.method.listSupportAccessSessions,
        request,
        context.requestHeader,
      );
      const sessions = listOrganizationSessions(read, caller.organizationId);
      const { items, page } = paginate(sessions, session => session.id, request.page, errors);

      return create(ListSupportAccessSessionsResponseSchema, { page, sessions: items });
    },
    listSupportAuditEntries: (request, context) => {
      const caller = guard.guardPermissionCall(read, SupportAccessService.method.listSupportAuditEntries, request, context.requestHeader);
      const entries = listSupportAuditEntries(read, caller.organizationId, request.sessionId);
      const { items, page } = paginate(entries, entry => entry.id, request.page, errors);

      return create(ListSupportAuditEntriesResponseSchema, { entries: items, page });
    },
    requestSupportAccess: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(
        transaction,
        SupportAccessService.method.requestSupportAccess,
        request,
        context.requestHeader,
      );

      return idempotency.run(transaction, {
        handler: () => {
          const target = resolveSessionTarget(transaction, caller, request);
          const session = create(SupportAccessSessionSchema, {
            durationMinutes: request.durationMinutes,
            emergencyReview: SupportEmergencyReview.NOT_REQUIRED,
            id: createSequencedId(random, countSupportAccessSessions(transaction)),
            kind: SupportAccessKind.NORMAL,
            mode: request.mode,
            organizationId: request.organizationId,
            requestedAt: timestampFromMs(transaction.worldTimeMs),
            section: request.section,
            staffDisplayName: caller.user.displayName,
            staffUserId: caller.user.id,
            status: SupportAccessStatus.REQUESTED,
            ticketId: request.ticketId,
            ticketNumber: target.ticketNumber,
            version: 1,
          });

          transaction.put('supportAccessSessions', session);
          appendSupportAuditEntry(transaction, random, {
            action: SupportAuditAction.SESSION_REQUESTED,
            actorUserId: caller.user.id,
            outcome: SupportAuditOutcome.ALLOWED,
            session,
          });
          transitioner.publish(transaction, session, SupportAccessChange.REQUESTED);
          postSupportAccessNotice(runtime, transaction, session, false);

          return create(RequestSupportAccessResponseSchema, { session });
        },
        idempotencyKey: request.idempotencyKey,
        method: SupportAccessService.method.requestSupportAccess,
        request,
        scope: resolveScope(caller),
      });
    }),
    startEmergencySupportAccess: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(
        transaction,
        SupportAccessService.method.startEmergencySupportAccess,
        request,
        context.requestHeader,
      );

      return idempotency.run(transaction, {
        handler: () => {
          const target = resolveSessionTarget(transaction, caller, request);
          const session = create(SupportAccessSessionSchema, {
            durationMinutes: request.durationMinutes,
            emergencyReason: request.emergencyReason,
            emergencyReview: SupportEmergencyReview.PENDING,
            expiresAt: timestampFromMs(transaction.worldTimeMs + request.durationMinutes * MINUTE_MS),
            id: createSequencedId(random, countSupportAccessSessions(transaction)),
            kind: SupportAccessKind.EMERGENCY,
            mode: request.mode,
            organizationId: request.organizationId,
            requestedAt: timestampFromMs(transaction.worldTimeMs),
            section: request.section,
            staffDisplayName: caller.user.displayName,
            staffUserId: caller.user.id,
            startedAt: timestampFromMs(transaction.worldTimeMs),
            status: SupportAccessStatus.ACTIVE,
            ticketId: request.ticketId,
            ticketNumber: target.ticketNumber,
            version: 1,
          });

          transaction.put('supportAccessSessions', session);
          appendSupportAuditEntry(transaction, random, {
            action: SupportAuditAction.SESSION_STARTED_EMERGENCY,
            actorUserId: caller.user.id,
            outcome: SupportAuditOutcome.ALLOWED,
            session,
          });
          transitioner.publish(transaction, session, SupportAccessChange.STARTED);
          postSupportAccessNotice(runtime, transaction, session, true);

          return create(StartEmergencySupportAccessResponseSchema, { session });
        },
        idempotencyKey: request.idempotencyKey,
        method: SupportAccessService.method.startEmergencySupportAccess,
        request,
        scope: resolveScope(caller),
      });
    }),
  };
};
