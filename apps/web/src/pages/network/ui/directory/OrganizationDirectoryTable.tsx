import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';

import { OrganizationDirectoryTableRow } from './OrganizationDirectoryTableRow';

interface OrganizationDirectoryTableProps {
  emptyState: ReactElement;
  isBusy: boolean;
  labelledBy: string;
  rows: readonly OrganizationDirectoryRowValue[];
  selectedOrganizationId: string | undefined;
}

const FRAME_CLASS_NAME = [
  'isolate max-h-[min(28rem,45vh)] overflow-auto rounded-control border border-line bg-panel-solid',
  '@max-lg:border-0 @max-lg:bg-transparent',
].join(' ');

const HEAD_CELL_CLASS_NAME = [
  'sticky top-0 z-10 border-b border-line bg-panel-solid px-3 py-2',
  'text-sm leading-5 font-medium text-on-panel-muted',
].join(' ');

const COLUMNS = [
  { className: 'w-[25%]', labelKey: 'organization.directory.column.name' },
  { className: 'w-[32%]', labelKey: 'organization.directory.column.profiles' },
  { className: 'w-[23%]', labelKey: 'organization.directory.column.spheres' },
  { className: 'w-[20%]', labelKey: 'organization.directory.column.cities' },
] as const;

export const OrganizationDirectoryTable = ({
  emptyState,
  isBusy,
  labelledBy,
  rows,
  selectedOrganizationId,
}: OrganizationDirectoryTableProps): ReactElement => {
  const { t } = useI18n();

  const isEmptyShown = rows.length === 0;

  return (
    <div className={FRAME_CLASS_NAME}>
      <table
        aria-labelledby={labelledBy}
        className="w-full table-fixed border-collapse text-left @max-lg:block"
        data-testid="organization-directory-table"
      >
        <thead className="@max-lg:sr-only">
          <tr>
            {COLUMNS.map(column => (
              <th className={cn(HEAD_CELL_CLASS_NAME, column.className)} key={column.labelKey} scope="col">
                {t(column.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={isBusy ? 'true' : undefined} className="@max-lg:flex @max-lg:flex-col @max-lg:gap-2">
          {rows.map(row => (
            <OrganizationDirectoryTableRow isSelected={row.id === selectedOrganizationId} key={row.id} row={row} />
          ))}
        </tbody>
      </table>
      {isEmptyShown && <div className="flex px-3 py-6">{emptyState}</div>}
    </div>
  );
};
