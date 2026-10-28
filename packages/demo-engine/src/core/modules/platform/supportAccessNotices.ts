import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { create } from '@bufbuild/protobuf';
import {
  NotificationImportance,
  NotificationKind,
  SupportAccessParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { listSupportAccessApprovers } from './supportAccessRecords';

export const postSupportAccessNotice = (
  runtime: Pick<IModuleRuntime, 'notifier'>,
  transaction: IStateTransaction,
  session: SupportAccessSession,
  isEmergency: boolean,
): void => {
  runtime.notifier.post(transaction, {
    importance: isEmergency ? NotificationImportance.CRITICAL : NotificationImportance.IMPORTANT,
    kind: isEmergency ? NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED : NotificationKind.SUPPORT_ACCESS_REQUESTED,
    links: [],
    organizationId: session.organizationId,
    params: {
      case: 'supportAccess',
      value: create(SupportAccessParamsSchema, {
        expiresAt: isEmergency ? session.expiresAt : undefined,
        sessionId: session.id,
        staffDisplayName: session.staffDisplayName,
        ticketNumber: session.ticketNumber,
      }),
    },
    recipients: listSupportAccessApprovers(transaction, session.organizationId),
  });
};
