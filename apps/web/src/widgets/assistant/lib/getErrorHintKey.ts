import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { KnownErrorCode } from '@/shared/api';

import { isKnownErrorCode } from '@/shared/api';

import type { AssistantCatalogValue } from '../i18n/assistantSection';

export type AssistantErrorHintKey = Extract<keyof AssistantCatalogValue, `assistant.error.hint.${string}`>;

const ERROR_HINT_KEYS = {
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: 'assistant.error.hint.idempotencyKeyReused',
  [ErrorCode.INTERNAL]: null,
  [ErrorCode.INVALID_TRANSITION]: 'assistant.error.hint.invalidTransition',
  [ErrorCode.LIMIT_EXCEEDED]: 'assistant.error.hint.limitExceeded',
  [ErrorCode.MEMBERSHIP_REQUIRED]: 'assistant.error.hint.membershipRequired',
  [ErrorCode.NOT_FOUND]: 'assistant.error.hint.notFound',
  [ErrorCode.PERMISSION_DENIED]: 'assistant.error.hint.permissionDenied',
  [ErrorCode.SESSION_REQUIRED]: null,
  [ErrorCode.UNAVAILABLE]: null,
  [ErrorCode.VALIDATION_FAILED]: null,
  [ErrorCode.VERSION_CONFLICT]: 'assistant.error.hint.versionConflict',
} as const satisfies Record<KnownErrorCode, AssistantErrorHintKey | null>;

export const getErrorHintKey = (code: ErrorCode): AssistantErrorHintKey | null => {
  return isKnownErrorCode(code) ? ERROR_HINT_KEYS[code] : null;
};
