import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';

import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';

import { OrganizationDirectoryRow } from './OrganizationDirectoryRow';
import { OrganizationDirectoryUnverifiedNote } from './OrganizationDirectoryUnverifiedNote';

interface OrganizationDirectoryListProps {
  focus: ObjectRefValue | undefined;
  isBusy: boolean;
  isViewerUnverified: boolean;
  rows: readonly OrganizationDirectoryRowValue[];
}

export const OrganizationDirectoryList = ({
  focus,
  isBusy,
  isViewerUnverified,
  rows,
}: OrganizationDirectoryListProps): ReactElement => {
  const { t } = useI18n();

  const selectedOrganizationId = focus?.type === 'organization' ? focus.id : undefined;

  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="sr-only">{t('organization.directory.count', { count: rows.length })}</p>
      <ul aria-busy={isBusy ? 'true' : undefined} className="flex flex-col gap-2" data-testid="network-company-list">
        {rows.map(row => (
          <OrganizationDirectoryRow isSelected={row.id === selectedOrganizationId} key={row.id} row={row} />
        ))}
      </ul>
      {isViewerUnverified && <OrganizationDirectoryUnverifiedNote />}
    </div>
  );
};
