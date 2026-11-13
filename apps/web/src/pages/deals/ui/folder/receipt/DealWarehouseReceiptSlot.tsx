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

import type { DealWarehouseReceiptProps } from './dealWarehouseReceiptTypes';

const loadWarehouseReceipt = createCachedModuleLoader(() => import('./DealWarehouseReceipt'));

export const DealWarehouseReceiptSlot = (props: DealWarehouseReceiptProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadWarehouseReceipt);
  const isFilled = useDelayedVisibility(state.kind === 'idle' || state.kind === 'loading');

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return <state.module.DealWarehouseReceipt {...props} />;
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

  return <SkeletonGroup isFilled={isFilled} label={t('routing.section.loading')}><Skeleton className="h-16" /></SkeletonGroup>;
};
