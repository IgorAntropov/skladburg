import type { ReactElement } from 'react';

import { useEffect } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useI18n } from '@/shared/i18n';
import { useChunkLoader } from '@/shared/lib/module-loader';
import {
  ChunkLoadNotice,
  Skeleton,
} from '@/shared/ui';

interface WarehouseLayoutSlotProps<TModule> {
  children: (module: TModule) => ReactElement;
  loader: CachedModuleLoader<TModule>;
}

export function WarehouseLayoutSlot<TModule>({ children, loader }: WarehouseLayoutSlotProps<TModule>): ReactElement {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loader);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return children(state.module);
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

  return <Skeleton className="h-28 w-full" />;
}
