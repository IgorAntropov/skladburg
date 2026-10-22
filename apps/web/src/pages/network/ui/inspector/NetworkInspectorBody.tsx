import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { WidgetStates } from '@/shared/ui';

import type { NetworkMapModelStateValue } from '../../api/useNetworkMapModel';

import { findNetworkMapObject } from '../../lib/findNetworkMapObject';
import { getInspectorSkeletonKind } from '../../lib/getInspectorSkeletonKind';
import { NetworkInspectorSkeleton } from '../NetworkInspectorSkeleton';
import { CityInspector } from './CityInspector';
import { InspectorNotFound } from './InspectorNotFound';
import { OrganizationInspectorSlot } from './OrganizationInspectorSlot';
import { SiteInspector } from './SiteInspector';

interface FoundObjectProps {
  focus: ObjectRefValue;
  model: NetworkMapModelValue;
}

interface NetworkInspectorBodyProps {
  focus: ObjectRefValue;
  state: NetworkMapModelStateValue;
}

const FoundObject = ({ focus, model }: FoundObjectProps): ReactElement => {
  const found = useMemo(() => findNetworkMapObject(model, focus), [focus, model]);

  if (found?.kind === 'organization') {
    return <OrganizationInspectorSlot cities={found.cities} organizationId={focus.id} sites={found.sites} />;
  }

  if (found?.kind === 'site') {
    return <SiteInspector city={found.city} site={found.site} />;
  }

  if (found?.kind === 'city') {
    return <CityInspector city={found.city} sites={found.sites} />;
  }

  return <InspectorNotFound />;
};

export const NetworkInspectorBody = ({ focus, state }: NetworkInspectorBodyProps): ReactElement => {
  const { t } = useI18n();
  const { organizationId } = useActingContext();

  const skeletonKind = getInspectorSkeletonKind(focus.type);
  const isOwnOrganization = focus.type === 'organization' && focus.id === organizationId;

  return (
    <WidgetStates
      data={state.data}
      error={state.error}
      isRetrying={state.isRetrying}
      loadingLabel={t('network.inspector.loading')}
      onRetry={state.retry}
      skeleton={<NetworkInspectorSkeleton isOwn={isOwnOrganization} kind={skeletonKind} />}
    >
      {model => <FoundObject focus={focus} model={model} />}
    </WidgetStates>
  );
};
