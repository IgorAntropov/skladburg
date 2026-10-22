import type { MessageKey } from '@/shared/i18n';

import type { VerificationLevelValue } from '../lib/normalizeVerificationLevel';

export const VERIFICATION_LEVEL_ARIA_KEYS = {
  0: 'verification.aria.0',
  1: 'verification.aria.1',
  2: 'verification.aria.2',
  3: 'verification.aria.3',
  4: 'verification.aria.4',
} as const satisfies Record<VerificationLevelValue, MessageKey>;

export const VERIFICATION_LEVEL_CHECKED_KEYS = {
  0: 'verification.levelChecked.0',
  1: 'verification.levelChecked.1',
  2: 'verification.levelChecked.2',
  3: 'verification.levelChecked.3',
  4: 'verification.levelChecked.4',
} as const satisfies Record<VerificationLevelValue, MessageKey>;

export const VERIFICATION_LEVEL_LABEL_KEYS = {
  0: 'verification.level.0',
  1: 'verification.level.1',
  2: 'verification.level.2',
  3: 'verification.level.3',
  4: 'verification.level.4',
} as const satisfies Record<VerificationLevelValue, MessageKey>;
