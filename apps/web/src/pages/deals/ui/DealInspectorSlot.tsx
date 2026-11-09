import type { Deal } from '@skladburg/contracts/deal/v1/deal';
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

interface DealInspectorSlotProps {
  counterpartyName: string | undefined;
  deal: Deal;
  documentFocusRequest?: number | undefined;
  initialDocumentId?: string | undefined;
  onRefresh: () => void;
  onUpdated: (deal: Deal) => void;
}

const loadDealInspector = createCachedModuleLoader(() => import('./inspector/dealInspectorEntry'));

export const DealInspectorSkeleton = (): ReactElement => (
  <div aria-hidden className="flex flex-col gap-3">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-16 w-full" />
  </div>
);

export const DealInspectorSlot = (props: DealInspectorSlotProps): ReactElement => {
  const { t } = useI18n();
  const { load, state } = useChunkLoader(loadDealInspector);
  const isLoading = state.kind === 'idle' || state.kind === 'loading';
  const isFilled = useDelayedVisibility(isLoading);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded') {
    return <state.module.DealInspector {...props} />;
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

  return <SkeletonGroup isFilled={isFilled} label={t('routing.section.loading')}><DealInspectorSkeleton /></SkeletonGroup>;
};
