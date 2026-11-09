import type { ReactElement } from 'react';

import { useEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { DealFolderProps } from './dealFolderTypes';

const loadDealFolder = createCachedModuleLoader(() => import('./dealFolderEntry'));

export const DealFolderSlot = (props: DealFolderProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadDealFolder);
  const isLoading = state.kind === 'idle' || state.kind === 'loading';
  const isFilled = useDelayedVisibility(isLoading);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return <state.module.DealFolder {...props} />;
  }
  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={t('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={t('routing.chunkError.repeated')}
      />
    );
  }

  return <SkeletonGroup isFilled={isFilled} label={t('routing.section.loading')}><Skeleton className="h-24" /></SkeletonGroup>;
};
