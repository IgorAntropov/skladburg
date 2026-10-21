import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';

import { loadNetworkInspector } from './loadNetworkInspector';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { NetworkInspectorSkeleton } from './NetworkInspectorSkeleton';

interface NetworkInspectorContentProps {
  focus: ObjectRefValue;
  state: NetworkMapModelStateValue;
}

export const NetworkInspectorContent = ({ focus, state }: NetworkInspectorContentProps): ReactElement => {
  const { t } = useI18n();

  const isModelPending = state.data === undefined && state.error === null;
  const skeletonKind = focus.type === 'city' ? 'city' : 'site';

  return (
    <NetworkChunkSlot
      isPending={isModelPending}
      loader={loadNetworkInspector}
      loadingLabel={t('network.inspector.loading')}
      skeleton={<NetworkInspectorSkeleton kind={skeletonKind} />}
    >
      {({ NetworkInspectorBody }) => <NetworkInspectorBody focus={focus} state={state} />}
    </NetworkChunkSlot>
  );
};
