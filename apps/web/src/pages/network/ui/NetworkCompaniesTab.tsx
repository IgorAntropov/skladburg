import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';

import type { NetworkMapModelStateValue } from '../api/useNetworkMapModel';
import type { OrganizationDirectoryFilterValue } from '../model/organizationDirectoryFilter';
import type { OrganizationDirectoryTableValue } from '../model/useOrganizationDirectoryTable';

import { loadNetworkCompanies } from './loadNetworkCompanies';
import { NetworkChunkSlot } from './NetworkChunkSlot';
import { OrganizationDirectoryListSkeleton } from './OrganizationDirectoryListSkeleton';

interface NetworkCompaniesTabProps {
  filter: OrganizationDirectoryFilterValue;
  focus: ObjectRefValue | undefined;
  onFilterChange: (filter: OrganizationDirectoryFilterValue) => void;
  state: NetworkMapModelStateValue;
  table: OrganizationDirectoryTableValue;
}

export const NetworkCompaniesTab = ({ filter, focus, onFilterChange, state, table }: NetworkCompaniesTabProps): ReactElement => {
  const { t } = useI18n();

  const isModelPending = state.data === undefined && state.error === null;

  return (
    <NetworkChunkSlot
      isPending={isModelPending}
      loader={loadNetworkCompanies}
      loadingLabel={t('organization.directory.loading')}
      skeleton={<OrganizationDirectoryListSkeleton />}
    >
      {({ NetworkCompaniesPanel }) => (
        <NetworkCompaniesPanel
          filter={filter}
          focus={focus}
          onFilterChange={onFilterChange}
          state={state}
          table={table}
        />
      )}
    </NetworkChunkSlot>
  );
};
