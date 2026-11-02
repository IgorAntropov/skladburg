import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useMemo } from 'react';

import { listingSection } from '@/entities/listing';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { CatalogTextsValue } from '../model/catalogTextsContext';

import { catalogSection } from '../i18n/catalogSection';
import { CatalogTextsContext } from '../model/catalogTextsContext';

interface CatalogTextsGateProps {
  children: ReactNode;
  skeleton: ReactNode;
}

export const CatalogTextsGate = ({ children, skeleton }: CatalogTextsGateProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry: retryCatalog, status: catalogStatus, t } = useCatalogSection(catalogSection);
  const { retry: retryListing, status: listingStatus, t: listingT } = useCatalogSection(listingSection);

  const texts = useMemo<CatalogTextsValue | undefined>(
    () => (t === undefined || listingT === undefined ? undefined : { listingT, t }),
    [listingT, t],
  );

  const isFailed = catalogStatus === 'error' || listingStatus === 'error';
  const isSkeletonFilled = useDelayedVisibility(texts === undefined && !isFailed);

  const handleRetryClick = (): void => {
    console.log('> CatalogTextsGate -> handleRetryClick:', { catalogStatus, listingStatus });

    if (catalogStatus === 'error') {
      retryCatalog();
    }

    if (listingStatus === 'error') {
      retryListing();
    }
  };

  if (texts !== undefined) {
    return <CatalogTextsContext value={texts}>{children}</CatalogTextsContext>;
  }

  if (isFailed) {
    return (
      <div className="flex max-w-prose flex-col items-start gap-3">
        <p className="text-base leading-6" role="alert">{mainT('routing.chunkError.message')}</p>
        <Button onClick={handleRetryClick} variant="secondary">{mainT('common.retry')}</Button>
      </div>
    );
  }

  return <SkeletonGroup isFilled={isSkeletonFilled} label={mainT('routing.section.loading')}>{skeleton}</SkeletonGroup>;
};
