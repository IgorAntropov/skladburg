import type { ReactElement } from 'react';

import { useEffect } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';
import { ChunkLoadNotice } from '@/shared/ui';

import { useChunkLoader } from '../lib/useChunkLoader';
import { useCatalogTexts } from '../model/useCatalogTexts';
import { loadOwnCatalog } from './loadOwnCatalog';
import { OwnCatalogSkeleton } from './skeleton/OwnCatalogSkeleton';

interface OwnTabSlotProps {
  focus: ObjectRefValue | undefined;
}

export const OwnTabSlot = ({ focus }: OwnTabSlotProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { t } = useCatalogTexts();
  const { load, state } = useChunkLoader(loadOwnCatalog);

  const isLoading = state.kind === 'idle' || state.kind === 'loading';
  const isSkeletonFilled = useDelayedVisibility(isLoading);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col" data-testid="catalog-tab-own">
      {state.kind === 'loaded' && <state.module.OwnCatalogPanel focus={focus} />}
      {state.kind === 'failed' && (
        <ChunkLoadNotice
          message={mainT('routing.chunkError.message')}
          onRetry={load}
          recovery={state.recovery}
          repeatedMessage={mainT('routing.chunkError.repeated')}
        />
      )}
      {isLoading && (
        <SkeletonGroup isFilled={isSkeletonFilled} label={t('catalog.own.loading')}>
          <OwnCatalogSkeleton />
        </SkeletonGroup>
      )}
    </div>
  );
};
