import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import type { MessageKey } from '@/shared/i18n';

import { isKnownErrorCode } from './isKnownErrorCode';

export type ErrorMessageKeyValue = ExistingMessageKey<`error.${KnownErrorName}`>;

type ExistingMessageKey<Key extends MessageKey> = Key;

type KnownErrorName = Lowercase<Exclude<keyof typeof ErrorCode, 'UNSPECIFIED'>>;

export const getErrorMessageKey = (code: ErrorCode): ErrorMessageKeyValue => {
  if (!isKnownErrorCode(code)) {
    return 'error.internal';
  }
  const name = ErrorCode[code].toLowerCase() as KnownErrorName;
  return `error.${name}`;
};
