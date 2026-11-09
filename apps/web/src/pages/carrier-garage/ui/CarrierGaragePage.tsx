import type { ReactElement } from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  Panel,
  SkeletonGroup,
} from '@/shared/ui';

import { garageSection } from '../i18n/garageSection';
import { GarageSkeleton } from './GarageSkeleton';
import { GarageWorkspace } from './GarageWorkspace';

export const CarrierGaragePage = (): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(garageSection);

  const handleRetry = (): void => {
    retry();
  };

  return (
    <div
      className="flex flex-1 flex-col items-center px-3 py-3 md:p-4"
      data-testid="page-garage"
    >
      <Panel
        aria-label={mainT('hud.panel.label')}
        as="section"
        className="flex min-w-0 w-full max-w-4xl flex-col gap-3 p-4"
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-on-panel">{mainT('section.garage.title')}</h1>
          {t !== undefined && <p className="text-sm text-on-panel-muted">{t('garage.description')}</p>}
        </header>
        {t !== undefined && <GarageWorkspace t={t} />}
        {status === 'loading' && <SkeletonGroup isFilled label={mainT('routing.section.loading')}><GarageSkeleton /></SkeletonGroup>}
        {status === 'error' && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert">{mainT('routing.chunkError.message')}</p>
            <Button onClick={handleRetry} variant="secondary">{mainT('common.retry')}</Button>
          </div>
        )}
      </Panel>
    </div>
  );
};
