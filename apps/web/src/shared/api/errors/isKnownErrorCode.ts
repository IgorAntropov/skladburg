import { ErrorCode } from '@skladburg/contracts/common/v1/error';

export type KnownErrorCode = Exclude<ErrorCode, ErrorCode.UNSPECIFIED>;

const KNOWN_ERROR_CODES: ReadonlySet<number> = new Set(
  Object.values(ErrorCode).filter((value): value is KnownErrorCode => typeof value === 'number' && value !== ErrorCode.UNSPECIFIED),
);

export const isKnownErrorCode = (code: number): code is KnownErrorCode => KNOWN_ERROR_CODES.has(code);
