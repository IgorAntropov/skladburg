import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { AssistantCatalogValue } from '../i18n/assistantSection';

export type AssistantErrorHintKey = Extract<keyof AssistantCatalogValue, `assistant.error.hint.${string}`>;

export const getErrorHintKey = (code: ErrorCode): AssistantErrorHintKey | null => {
  switch (code) {
    case ErrorCode.IDEMPOTENCY_KEY_REUSED:
      return 'assistant.error.hint.idempotencyKeyReused';
    case ErrorCode.IMPORT_FILE_INVALID:
    case ErrorCode.IMPORT_ROLLBACK_BLOCKED:
    case ErrorCode.INTERNAL:
    case ErrorCode.SESSION_REQUIRED:
    case ErrorCode.UNAVAILABLE:
    case ErrorCode.UNSPECIFIED:
    case ErrorCode.VALIDATION_FAILED:
      return null;
    case ErrorCode.INVALID_TRANSITION:
      return 'assistant.error.hint.invalidTransition';
    case ErrorCode.LIMIT_EXCEEDED:
      return 'assistant.error.hint.limitExceeded';
    case ErrorCode.MEMBERSHIP_REQUIRED:
      return 'assistant.error.hint.membershipRequired';
    case ErrorCode.NOT_FOUND:
      return 'assistant.error.hint.notFound';
    case ErrorCode.PERMISSION_DENIED:
      return 'assistant.error.hint.permissionDenied';
    case ErrorCode.VERSION_CONFLICT:
      return 'assistant.error.hint.versionConflict';
    default:
      code satisfies never;

      return null;
  }
};
