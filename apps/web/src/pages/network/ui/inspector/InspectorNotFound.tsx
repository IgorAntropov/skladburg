import type { ReactElement } from 'react';

import { SearchX } from 'lucide-react';

import { useI18n } from '@/shared/i18n';

export const InspectorNotFound = (): ReactElement => {
  const { t } = useI18n();

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center"
      data-testid="network-inspector-not-found"
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-on-panel-muted">
        <SearchX className="size-5" />
      </span>
      <div className="flex max-w-80 flex-col gap-1">
        <p className="text-base text-pretty text-on-panel-muted">{t('network.inspector.notFound.title')}</p>
        <p className="text-sm text-pretty text-on-panel-muted">{t('network.inspector.notFound.hint')}</p>
      </div>
    </div>
  );
};
