import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import { parseApiError } from '@/shared/api';

export const isNotFoundError = (error: Error | null): boolean => error !== null && parseApiError(error).code === ErrorCode.NOT_FOUND;
