import type { ReactElement } from 'react';

import {
  MapPin,
  Tags,
} from 'lucide-react';
import {
  useEffect,
  useRef,
} from 'react';

import { ProfileBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';

import { resolveScrollBehavior } from '../../lib/resolveScrollBehavior';
import { NETWORK_ROW_CLASS_NAME } from '../networkRowStyles';
import { OrganizationOwnMark } from './OrganizationOwnMark';

interface OrganizationDirectoryRowProps {
  isSelected: boolean;
  row: OrganizationDirectoryRowValue;
}

const FACT_CLASS_NAME = 'flex min-w-0 items-center gap-2 text-sm leading-5 text-on-panel-muted';

const FACT_ICON_CLASS_NAME = 'size-4 shrink-0';

export const OrganizationDirectoryRow = ({ isSelected, row }: OrganizationDirectoryRowProps): ReactElement => {
  const { t } = useI18n();
  const linkRef = useRef<HTMLAnchorElement>(null);

  const spheresText = row.sphereNames.length === 0 ? t('organization.directory.noSpheres') : row.sphereNames.join(', ');
  const citiesText = row.cityNames.length === 0 ? t('organization.directory.noCities') : row.cityNames.join(', ');

  const isCitiesNamed = row.cityNames.length > 0;

  const handleClick = (): void => {
    console.log('> OrganizationDirectoryRow -> handleClick:', { organizationId: row.id });
  };

  useEffect(() => {
    if (isSelected) {
      linkRef.current?.scrollIntoView({ behavior: resolveScrollBehavior(), block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <li>
      <AddressLink
        aria-current={isSelected ? 'true' : undefined}
        className={NETWORK_ROW_CLASS_NAME}
        data-organization-id={row.id}
        data-testid="network-company-row"
        onClick={handleClick}
        ref={linkRef}
        to={{ kind: 'object', object: { id: row.id, type: 'organization' } }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate text-base leading-6 font-semibold text-on-panel" translate="no">
            {row.name}
          </span>
          {row.isOwn && <OrganizationOwnMark />}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {row.profiles.map(profile => (
            <ProfileBadge isCompact key={profile.kind} kind={profile.kind} level={profile.verificationLevel} />
          ))}
        </span>
        <span className={FACT_CLASS_NAME}>
          <Tags aria-hidden className={FACT_ICON_CLASS_NAME} />
          <span className="sr-only">{`${t('organization.directory.column.spheres')}:`}</span>
          <span className="truncate">{spheresText}</span>
        </span>
        <span className={FACT_CLASS_NAME}>
          <MapPin aria-hidden className={FACT_ICON_CLASS_NAME} />
          <span className="sr-only">{`${t('organization.directory.column.cities')}:`}</span>
          <span className="truncate" translate={isCitiesNamed ? 'no' : undefined}>{citiesText}</span>
        </span>
      </AddressLink>
    </li>
  );
};
