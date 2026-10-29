import type { ReactElement } from 'react';

import { Zap } from 'lucide-react';

import type { SupportTranslate } from '../../lib/supportTranslate';

interface SupportUrgentBadgeProps {
  t: SupportTranslate;
}

export const SupportUrgentBadge = ({ t }: SupportUrgentBadgeProps): ReactElement => {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-status-warning px-2 text-xs font-semibold text-on-status-warning">
      <Zap aria-hidden className="size-3.5" />
      {t('support.priority.urgent')}
    </span>
  );
};
