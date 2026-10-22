import type { ReactElement } from 'react';

import type {
  NetworkMapCityValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import { loadOrganizationInspector } from '../loadOrganizationInspector';
import { NetworkChunkSlot } from '../NetworkChunkSlot';
import { NetworkInspectorSkeleton } from '../NetworkInspectorSkeleton';

interface OrganizationInspectorSlotProps {
  cities: readonly NetworkMapCityValue[];
  organizationId: string;
  sites: readonly NetworkMapSiteValue[];
}

export const OrganizationInspectorSlot = ({ cities, organizationId, sites }: OrganizationInspectorSlotProps): ReactElement => {
  const { t } = useI18n();
  const { organizationId: actingOrganizationId } = useActingContext();

  const isOwn = organizationId === actingOrganizationId;

  return (
    <NetworkChunkSlot
      loader={loadOrganizationInspector}
      loadingLabel={t('network.inspector.loading')}
      skeleton={<NetworkInspectorSkeleton isOwn={isOwn} kind="organization" />}
    >
      {({ OrganizationInspector }) => (
        <OrganizationInspector cities={cities} organizationId={organizationId} sites={sites} />
      )}
    </NetworkChunkSlot>
  );
};
