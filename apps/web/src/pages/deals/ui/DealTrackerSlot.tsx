import type {
  Deal,
  DealReceipt,
} from '@skladburg/contracts/deal/v1/deal';
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
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import { dealsSection } from '../i18n/dealsSection';

interface DealTrackerSlotProps {
  deal: Deal;
  receipt: DealReceipt | undefined;
}

const loadDealTracker = createCachedModuleLoader(() => import('./DealTracker'));

export const DealTrackerSlot = ({ deal, receipt }: DealTrackerSlotProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { t } = useCatalogSection(dealsSection);
  const { load, state } = useChunkLoader(loadDealTracker);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loaded' && t !== undefined) {
    return <state.module.DealTracker deal={deal} receipt={receipt} t={t} />;
  }
  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={baseText('routing.chunkError.message')}
        onRetry={load}
        recovery={state.recovery}
        repeatedMessage={baseText('routing.chunkError.repeated')}
      />
    );
  }

  return <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-16" /></SkeletonGroup>;
};
