import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  BadgeCheck,
  Shield,
  ShieldQuestionMark,
} from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { VerificationLevelValue } from '../lib/normalizeVerificationLevel';

import {
  VERIFICATION_LEVEL_ARIA_KEYS,
  VERIFICATION_LEVEL_LABEL_KEYS,
} from '../config/verificationLevels';
import { normalizeVerificationLevel } from '../lib/normalizeVerificationLevel';

interface VerificationBadgeProps {
  isCompact?: boolean | undefined;
  level: number;
}

interface VerificationGlyphProps {
  Icon: LucideIcon;
  level: VerificationLevelValue;
}

const BASE_CLASS_NAME = 'inline-flex shrink-0 items-center justify-center rounded-full border';

const LEVEL_CLASS_NAMES = {
  0: 'border-2 border-dashed border-line-strong text-on-panel-muted',
  1: 'border-line-strong text-on-panel',
  2: 'border-line-strong text-on-panel',
  3: 'border-line-strong text-on-panel',
  4: 'border-on-panel bg-on-panel text-panel-solid',
} as const satisfies Record<VerificationLevelValue, string>;

const COMPACT_CLASS_NAME = 'size-6.5';

const FULL_CLASS_NAME = 'gap-1.5 py-0.5 ps-1.5 pe-2.5 text-sm leading-5 font-medium whitespace-nowrap';

const FULL_UNVERIFIED_CLASS_NAME = 'gap-1.5 py-px ps-1 pe-2 text-sm leading-5 font-medium whitespace-nowrap';

const GLYPH_ICONS = {
  0: ShieldQuestionMark,
  1: Shield,
  2: Shield,
  3: Shield,
  4: BadgeCheck,
} as const satisfies Record<VerificationLevelValue, LucideIcon>;

const VerificationGlyph = ({ Icon, level }: VerificationGlyphProps): ReactElement => {
  const isDigitShown = level >= 1 && level <= 3;

  if (!isDigitShown) {
    return <Icon aria-hidden className="size-5" />;
  }

  return (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <Icon aria-hidden className="size-5" />
      <span aria-hidden className="absolute inset-0 flex items-center justify-center text-xs leading-none font-bold tabular-nums">
        {level}
      </span>
    </span>
  );
};

export const VerificationBadge = ({ isCompact = false, level }: VerificationBadgeProps): ReactElement => {
  const { t } = useI18n();

  const normalizedLevel = normalizeVerificationLevel(level);
  const fullClassName = normalizedLevel === 0 ? FULL_UNVERIFIED_CLASS_NAME : FULL_CLASS_NAME;

  return (
    <span
      aria-label={t(VERIFICATION_LEVEL_ARIA_KEYS[normalizedLevel])}
      className={cn(BASE_CLASS_NAME, LEVEL_CLASS_NAMES[normalizedLevel], isCompact ? COMPACT_CLASS_NAME : fullClassName)}
      data-level={normalizedLevel}
      data-testid="verification-badge"
      role="img"
    >
      <VerificationGlyph Icon={GLYPH_ICONS[normalizedLevel]} level={normalizedLevel} />
      {isCompact ? undefined : <span aria-hidden>{t(VERIFICATION_LEVEL_LABEL_KEYS[normalizedLevel])}</span>}
    </span>
  );
};
