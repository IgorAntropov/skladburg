import type { ReactElement } from 'react';

import {
  MapPin,
  Tags,
} from 'lucide-react';

import { ProfileBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';

import { OrganizationOwnMark } from '../companies/OrganizationOwnMark';

interface OrganizationDirectoryTableRowProps {
  isSelected: boolean;
  row: OrganizationDirectoryRowValue;
}

const ROW_CLASS_NAME = [
  'group relative motion-safe:transition-[background-color] hover:bg-hover active:bg-line',
  'has-[a[aria-current=true]]:bg-hover',
  '@lg:border-b @lg:border-line @lg:last:border-b-0',
  '@max-lg:flex @max-lg:flex-col @max-lg:gap-1 @max-lg:rounded-control @max-lg:border @max-lg:border-line @max-lg:px-3 @max-lg:py-2',
].join(' ');

const CELL_CLASS_NAME = 'px-3 py-3 align-top @max-lg:block @max-lg:p-0';

const LINK_CLASS_NAME = [
  'text-base leading-6 font-semibold text-on-panel',
  'underline-offset-2 group-hover:underline',
  'after:absolute after:inset-0 after:content-[\'\'] @max-lg:after:rounded-control',
  'focus-visible:outline-none',
  'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus',
  'aria-[current=true]:after:ring-2 aria-[current=true]:after:ring-indicator aria-[current=true]:after:ring-inset',
].join(' ');

const FACT_CLASS_NAME = 'flex min-w-0 items-start gap-2 text-sm leading-5 text-on-panel-muted';

const FACT_ICON_CLASS_NAME = 'mt-0.5 size-4 shrink-0 @lg:hidden';

const FACT_LABEL_CLASS_NAME = 'sr-only @lg:hidden';

export const OrganizationDirectoryTableRow = ({ isSelected, row }: OrganizationDirectoryTableRowProps): ReactElement => {
  const { t } = useI18n();

  const spheresText = row.sphereNames.length === 0 ? t('organization.directory.noSpheres') : row.sphereNames.join(', ');
  const citiesText = row.cityNames.length === 0 ? t('organization.directory.noCities') : row.cityNames.join(', ');

  const isCitiesNamed = row.cityNames.length > 0;

  const handleClick = (): void => {
    console.log('> OrganizationDirectoryTableRow -> handleClick:', { organizationId: row.id });
  };

  return (
    <tr className={ROW_CLASS_NAME} data-organization-id={row.id} data-testid="network-company-row">
      <td className={CELL_CLASS_NAME}>
        <span className="block min-w-0 wrap-break-word">
          <AddressLink
            aria-current={isSelected ? 'true' : undefined}
            className={LINK_CLASS_NAME}
            onClick={handleClick}
            to={{ kind: 'object', object: { id: row.id, type: 'organization' } }}
            translate="no"
          >
            {row.name}
          </AddressLink>
          {row.isOwn && (
            <span className="ms-2 align-middle">
              <OrganizationOwnMark />
            </span>
          )}
        </span>
      </td>
      <td className={CELL_CLASS_NAME}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {row.profiles.map(profile => (
            <ProfileBadge isCompact key={profile.kind} kind={profile.kind} level={profile.verificationLevel} />
          ))}
        </span>
      </td>
      <td className={CELL_CLASS_NAME}>
        <span className={FACT_CLASS_NAME}>
          <Tags aria-hidden className={FACT_ICON_CLASS_NAME} />
          <span className={FACT_LABEL_CLASS_NAME}>{`${t('organization.directory.column.spheres')}:`}</span>
          <span className="line-clamp-2 min-w-0 wrap-break-word">{spheresText}</span>
        </span>
      </td>
      <td className={CELL_CLASS_NAME}>
        <span className={FACT_CLASS_NAME}>
          <MapPin aria-hidden className={FACT_ICON_CLASS_NAME} />
          <span className={FACT_LABEL_CLASS_NAME}>{`${t('organization.directory.column.cities')}:`}</span>
          <span className="line-clamp-2 min-w-0 wrap-break-word" translate={isCitiesNamed ? 'no' : undefined}>{citiesText}</span>
        </span>
      </td>
    </tr>
  );
};
