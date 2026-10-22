import type { ApiErrorValue } from '@/shared/api';

import { getFieldViolations } from '@/shared/api';

const SIGNATURE_RULE_ID = 'avatar_image_signature';

export const readAvatarServerErrorKey = (error: ApiErrorValue | undefined): 'validation.avatar_image_signature' | undefined => {
  if (error === undefined) {
    return undefined;
  }

  const isSignatureRejected = getFieldViolations(error).some(violation => violation.ruleId === SIGNATURE_RULE_ID);

  return isSignatureRejected ? 'validation.avatar_image_signature' : undefined;
};
