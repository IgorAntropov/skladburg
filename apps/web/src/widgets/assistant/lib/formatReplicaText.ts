import type { Notification } from '@skladburg/contracts/notification/v1/notification';

import { NotificationKind } from '@skladburg/contracts/notification/v1/notification';

import type { SectionTranslate } from '@/shared/i18n';

import type { AssistantCatalogValue } from '../i18n/assistantSection';
import type {
  DigestLineValue,
  ReplicaValue,
} from '../model/replicaTypes';

export type AssistantTranslate = SectionTranslate<AssistantCatalogValue>;

export type ReplicaTextValue
  = | { greeting: string; items: string[]; kind: 'list' }
    | { kind: 'paragraphs'; paragraphs: string[] };

const formatSupportAccess = (t: AssistantTranslate, { kind, params }: Notification): string => {
  if (params.case !== 'supportAccess') {
    return t('assistant.replica.unknown');
  }

  if (kind === NotificationKind.SUPPORT_ACCESS_REQUESTED) {
    return t('assistant.replica.supportAccessRequested', { ticketNumber: String(params.value.ticketNumber) });
  }

  return kind === NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED
    ? t('assistant.replica.supportEmergencyAccessStarted', { staff: params.value.staffDisplayName })
    : t('assistant.replica.unknown');
};

const formatNotification = (t: AssistantTranslate, notification: Notification): string => {
  const { params } = notification;

  switch (params.case) {
    case 'partnerVerified': {
      const { organizationName, verificationLevel } = params.value;

      return t('assistant.replica.partnerVerified', { organizationName, verificationLevel });
    }
    case 'supportAccess':
      return formatSupportAccess(t, notification);
    case 'supportReply': {
      const { ticketNumber } = params.value;

      return t('assistant.replica.supportReply', { ticketNumber: String(ticketNumber) });
    }
    case undefined:
      return t('assistant.replica.unknown');
    case 'verificationNextLevel': {
      const { currentLevel, nextLevel } = params.value;

      return t('assistant.replica.verificationNextLevel', { currentLevel, nextLevel });
    }
    case 'warehouseCreated': {
      const { cityName, warehouseName } = params.value;

      return t('assistant.replica.warehouseCreated', { cityName, warehouseName });
    }
  }
};

const formatDigestLine = (t: AssistantTranslate, line: DigestLineValue): string => {
  return line.kind === 'nextLevel'
    ? t('assistant.digest.nextLevel', { nextLevel: line.nextLevel })
    : t(line.key, { count: line.count });
};

export const formatReplicaText = (t: AssistantTranslate, { body }: ReplicaValue): ReplicaTextValue => {
  switch (body.kind) {
    case 'digest':
      return {
        greeting: t('assistant.digest.greeting'),
        items: body.lines.map(line => formatDigestLine(t, line)),
        kind: 'list',
      };
    case 'error':
      return {
        kind: 'paragraphs',
        paragraphs: [t('assistant.error.lead', { reason: body.reason }), t(body.hintKey)],
      };
    case 'more':
      return { kind: 'paragraphs', paragraphs: [t('assistant.replica.more', { count: body.count })] };
    case 'notification':
      return { kind: 'paragraphs', paragraphs: [formatNotification(t, body.notification)] };
  }
};

export const getReplicaAnnouncement = (text: ReplicaTextValue): string => {
  return text.kind === 'list' ? [text.greeting, ...text.items].join('. ') : text.paragraphs.join(' ');
};
