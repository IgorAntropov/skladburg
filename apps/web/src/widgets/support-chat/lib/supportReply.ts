import {
  type SupportReply,
  SupportReplyTemplate,
  type SupportTicketMessage,
} from '@skladburg/contracts/support/v1/support_ticket';

import type { SupportCatalogValue } from '../i18n/supportSection';
import type { SupportTranslate } from './supportTranslate';

import { formatErrorCodeName } from './formatErrorCodeName';

type KnownSupportReplyTemplateValue = Exclude<SupportReplyTemplate, SupportReplyTemplate.UNSPECIFIED>;

export const SUPPORT_REPLY_KEYS = {
  [SupportReplyTemplate.ACKNOWLEDGED]: 'support.reply.acknowledged',
  [SupportReplyTemplate.ERROR_EXPLAINED]: 'support.reply.errorExplained',
  [SupportReplyTemplate.URGENT_ACKNOWLEDGED]: 'support.reply.urgentAcknowledged',
} as const satisfies Record<KnownSupportReplyTemplateValue, keyof SupportCatalogValue>;

export const SUPPORT_REPLY_NO_TRACE_KEY = 'support.reply.errorExplainedNoTrace';

export const resolveSupportReplyKey = (
  reply: SupportReply,
): typeof SUPPORT_REPLY_KEYS[KnownSupportReplyTemplateValue] | typeof SUPPORT_REPLY_NO_TRACE_KEY => {
  if (reply.template === SupportReplyTemplate.UNSPECIFIED) {
    return SUPPORT_REPLY_KEYS[SupportReplyTemplate.ACKNOWLEDGED];
  }

  const isTraceMissing = reply.template === SupportReplyTemplate.ERROR_EXPLAINED && reply.traceId === '';

  return isTraceMissing ? SUPPORT_REPLY_NO_TRACE_KEY : SUPPORT_REPLY_KEYS[reply.template];
};

export const formatSupportReply = (t: SupportTranslate, reply: SupportReply): string => {
  const key = resolveSupportReplyKey(reply);

  if (key === 'support.reply.errorExplained') {
    return t(key, { errorCode: formatErrorCodeName(reply.errorCode), traceId: reply.traceId });
  }

  if (key === 'support.reply.errorExplainedNoTrace') {
    return t(key, { errorCode: formatErrorCodeName(reply.errorCode) });
  }

  return t(key);
};

export const formatSupportMessage = (t: SupportTranslate, { body }: SupportTicketMessage): string => {
  switch (body.case) {
    case 'reply':
      return formatSupportReply(t, body.value);
    case 'text':
      return body.value;
    case undefined:
      return '';
    default: {
      const unhandledBody: never = body;

      return unhandledBody;
    }
  }
};
