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
} from '@/shared/ui';

const loadDirectory = createCachedModuleLoader(() => import('./WarehouseStaffDirectory'));

export const WarehouseStaffSlot = ({ warehouseId }: { warehouseId: string | undefined }): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadDirectory);
  useEffect(() => {
    load();
  }, [load]);
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
  if (state.kind === 'loaded') {
    return <state.module.WarehouseStaffDirectory warehouseId={warehouseId} />;
  }
  return <SkeletonGroup isFilled label={t('routing.section.loading')}><Skeleton className="h-16 w-full" /></SkeletonGroup>;
};
