import { ErrorCode } from '@skladburg/contracts/common/v1/error';

export const formatErrorCodeName = (code: ErrorCode): string => ErrorCode[code];
