import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';

import { getInspectorSkeletonKind } from '../lib/getInspectorSkeletonKind';
import { loadNetworkInspector } from './loadNetworkInspector';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { NetworkInspectorSkeleton } from './NetworkInspectorSkeleton';

interface NetworkInspectorContentProps {
  focus: ObjectRefValue;
  state: NetworkMapModelStateValue;
}

export const NetworkInspectorContent = ({ focus, state }: NetworkInspectorContentProps): ReactElement => {
  const { t } = useI18n();
  const { organizationId } = useActingContext();

  const isModelPending = state.data === undefined && state.error === null;
  const skeletonKind = getInspectorSkeletonKind(focus.type);
  const isOwnOrganization = focus.type === 'organization' && focus.id === organizationId;

  return (
    <NetworkChunkSlot
      isPending={isModelPending}
      loader={loadNetworkInspector}
      loadingLabel={t('network.inspector.loading')}
      skeleton={<NetworkInspectorSkeleton isOwn={isOwnOrganization} kind={skeletonKind} />}
    >
      {({ NetworkInspectorBody }) => <NetworkInspectorBody focus={focus} state={state} />}
    </NetworkChunkSlot>
  );
};
