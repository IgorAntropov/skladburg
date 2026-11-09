import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import { parseApiError } from './parseApiError';

const DENIED_CODES: readonly ErrorCode[] = [
  ErrorCode.MEMBERSHIP_REQUIRED,
  ErrorCode.NOT_FOUND,
  ErrorCode.PERMISSION_DENIED,
  ErrorCode.SESSION_REQUIRED,
];
const DENIED_TRANSPORT_CODES: readonly Code[] = [Code.NotFound, Code.PermissionDenied, Code.Unauthenticated];

export const isReadAccessDenied = (error: Error | null): boolean => error instanceof ConnectError
  && (DENIED_TRANSPORT_CODES.includes(error.code) || DENIED_CODES.includes(parseApiError(error).code));
