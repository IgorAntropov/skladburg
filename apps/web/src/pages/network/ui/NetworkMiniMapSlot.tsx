import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';

import { findNetworkMapObject } from '../lib/findNetworkMapObject';
import { loadNetworkMiniMap } from './loadNetworkMiniMap';
import { NetworkChunkSlot } from './NetworkChunkSlot';

interface NetworkMiniMapSlotProps {
  focus: ObjectRefValue | undefined;
  model: NetworkMapModelValue;
}

const MiniMapSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-44 w-full" />
    <div className="flex h-5 items-center">
      <Skeleton className="h-4 w-40" />
    </div>
  </div>
);

export const NetworkMiniMapSlot = ({ focus, model }: NetworkMiniMapSlotProps): ReactElement => {
  const { t } = useI18n();

  const selectedCityId = useMemo(() => {
    const found = findNetworkMapObject(model, focus);

    return found === undefined || found.kind === 'organization' ? undefined : found.city.id;
  }, [focus, model]);

  return (
    <NetworkChunkSlot
      loader={loadNetworkMiniMap}
      loadingLabel={t('network.miniMap.loading')}
      skeleton={<MiniMapSkeleton />}
    >
      {({ NetworkMiniMap }) => <NetworkMiniMap model={model} selectedCityId={selectedCityId} />}
    </NetworkChunkSlot>
  );
};
