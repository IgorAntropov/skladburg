import type { FieldViolation } from '@skladburg/contracts/common/v1/error';

import type { ApiErrorValue } from './apiErrorTypes';

export const getFieldViolations = (error: ApiErrorValue): readonly FieldViolation[] =>
  error.params.case === 'validationFailed' ? error.params.value.violations : [];
