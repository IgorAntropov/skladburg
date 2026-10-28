import type { ReactElement } from 'react';

import { SearchX } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui';

export const InspectorNotFound = (): ReactElement => {
  const { t } = useI18n();

  return (
    <EmptyState
      className="py-4"
      data-testid="network-inspector-not-found"
      hint={t('network.inspector.notFound.hint')}
      icon={SearchX}
      text={t('network.inspector.notFound.title')}
    />
  );
};
