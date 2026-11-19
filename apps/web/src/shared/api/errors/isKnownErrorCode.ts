import { ErrorCode } from '@skladburg/contracts/common/v1/error';

export type KnownErrorCode = Exclude<ErrorCode, ErrorCode.UNSPECIFIED>;

const UNSPECIFIED_ERROR_CODE: number = ErrorCode.UNSPECIFIED;

export const isKnownErrorCode = (code: number): code is KnownErrorCode =>
  code !== UNSPECIFIED_ERROR_CODE && typeof ErrorCode[code] === 'string';
