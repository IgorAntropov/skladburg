import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';
import type { OrganizationDirectoryFilterValue } from '../model/organizationDirectoryFilter';
import type { OrganizationDirectoryTableValue } from '../model/useOrganizationDirectoryTable';

import { loadOrganizationDirectoryPanel } from './loadOrganizationDirectoryPanel';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { OrganizationDirectoryPanelSkeleton } from './OrganizationDirectoryPanelSkeleton';

interface OrganizationDirectoryPanelSlotProps {
  filter: OrganizationDirectoryFilterValue;
  focus: ObjectRefValue | undefined;
  onFilterChange: (filter: OrganizationDirectoryFilterValue) => void;
  state: NetworkMapModelStateValue;
  table: OrganizationDirectoryTableValue;
}

export const OrganizationDirectoryPanelSlot = ({
  filter,
  focus,
  onFilterChange,
  state,
  table,
}: OrganizationDirectoryPanelSlotProps): ReactElement => {
  const { t } = useI18n();

  const isModelPending = state.data === undefined && state.error === null;

  return (
    <NetworkChunkSlot
      isPending={isModelPending}
      loader={loadOrganizationDirectoryPanel}
      loadingLabel={t('organization.directory.loading')}
      skeleton={<OrganizationDirectoryPanelSkeleton />}
    >
      {({ OrganizationDirectoryPanel }) => (
        <OrganizationDirectoryPanel
          filter={filter}
          focus={focus}
          onClose={table.close}
          onFilterChange={onFilterChange}
          panelId={table.panelId}
          state={state}
        />
      )}
    </NetworkChunkSlot>
  );
};
