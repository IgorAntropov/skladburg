import type { ReactElement } from 'react';

import { useEffect } from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import type { OrderLauncherProps } from './OrderLauncher';

import { orderSection } from '../../i18n/order/orderSection';

type OrderLauncherSlotProps = Omit<OrderLauncherProps, 't'>;

const loadOrderLauncher = createCachedModuleLoader(() => import('./orderLauncherEntry'));

export const OrderLauncherSlot = (props: OrderLauncherSlotProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(orderSection);
  const { load, state } = useChunkLoader(loadOrderLauncher);
  const isFailed = status === 'error' || state.kind === 'failed';
  const isLoading = !isFailed && (t === undefined || state.kind !== 'loaded');
  const isFilled = useDelayedVisibility(isLoading);

  const handleRetryTexts = (): void => {
    console.log('> OrderLauncherSlot -> handleRetryTexts:', {});
    retry();
  };

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded' && t !== undefined) {
    return <state.module.OrderLauncher {...props} t={t} />;
  }

  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={mainT('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={mainT('routing.chunkError.repeated')}
      />
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-base leading-6" role="alert">{mainT('routing.chunkError.message')}</p>
        <Button onClick={handleRetryTexts} variant="secondary">{mainT('common.retry')}</Button>
      </div>
    );
  }

  return (
    <SkeletonGroup isFilled={isFilled} label={mainT('routing.section.loading')}>
      <Skeleton className="h-11 w-28" />
    </SkeletonGroup>
  );
};
