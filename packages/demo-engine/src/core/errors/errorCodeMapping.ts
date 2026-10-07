import { Code } from '@connectrpc/connect';
import { ErrorCategory } from '@skladburg/contracts/common/v1/error';

const CONNECT_CODE_BY_CATEGORY: Readonly<Record<ErrorCategory, Code>> = {
  [ErrorCategory.ABORTED]: Code.Aborted,
  [ErrorCategory.FAILED_PRECONDITION]: Code.FailedPrecondition,
  [ErrorCategory.INTERNAL]: Code.Internal,
  [ErrorCategory.INVALID_ARGUMENT]: Code.InvalidArgument,
  [ErrorCategory.NOT_FOUND]: Code.NotFound,
  [ErrorCategory.PERMISSION_DENIED]: Code.PermissionDenied,
  [ErrorCategory.UNAUTHENTICATED]: Code.Unauthenticated,
  [ErrorCategory.UNAVAILABLE]: Code.Unavailable,
  [ErrorCategory.UNSPECIFIED]: Code.Unknown,
};

export const toConnectCode = (category: ErrorCategory): Code => CONNECT_CODE_BY_CATEGORY[category];
