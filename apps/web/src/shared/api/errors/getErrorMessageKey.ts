import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { MessageKey } from '@/shared/i18n';

import type { KnownErrorCode } from './isKnownErrorCode';

import { isKnownErrorCode } from './isKnownErrorCode';

const ERROR_MESSAGE_KEYS = {
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: 'error.idempotency_key_reused',
  [ErrorCode.IMPORT_FILE_INVALID]: 'error.import_file_invalid',
  [ErrorCode.IMPORT_ROLLBACK_BLOCKED]: 'error.import_rollback_blocked',
  [ErrorCode.INTERNAL]: 'error.internal',
  [ErrorCode.INVALID_TRANSITION]: 'error.invalid_transition',
  [ErrorCode.LIMIT_EXCEEDED]: 'error.limit_exceeded',
  [ErrorCode.MEMBERSHIP_REQUIRED]: 'error.membership_required',
  [ErrorCode.NOT_FOUND]: 'error.not_found',
  [ErrorCode.PERMISSION_DENIED]: 'error.permission_denied',
  [ErrorCode.SESSION_REQUIRED]: 'error.session_required',
  [ErrorCode.UNAVAILABLE]: 'error.unavailable',
  [ErrorCode.VALIDATION_FAILED]: 'error.validation_failed',
  [ErrorCode.VERSION_CONFLICT]: 'error.version_conflict',
  [ErrorCode.WAREHOUSE_LAYOUT_BUSY]: 'error.warehouse_layout_busy',
  [ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID]: 'error.warehouse_layout_session_invalid',
  [ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED]: 'error.warehouse_receiving_layout_blocked',
} as const satisfies Record<KnownErrorCode, MessageKey>;

export type ErrorMessageKeyValue = (typeof ERROR_MESSAGE_KEYS)[KnownErrorCode];

export const getErrorMessageKey = (code: ErrorCode): ErrorMessageKeyValue =>
  isKnownErrorCode(code) ? ERROR_MESSAGE_KEYS[code] : ERROR_MESSAGE_KEYS[ErrorCode.INTERNAL];
