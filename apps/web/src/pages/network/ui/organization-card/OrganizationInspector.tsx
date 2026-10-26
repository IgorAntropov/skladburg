import type { ReactElement } from 'react';

import { ChevronRight } from 'lucide-react';
import {
  useId,
  useMemo,
} from 'react';

import type {
  NetworkMapCityValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { AddressLink } from '@/shared/routing';
import { WidgetStates } from '@/shared/ui';

import type { OrganizationCardValue } from '../../lib/organizationCardTypes';

import { useOrganizationCard } from '../../api/directory/useOrganizationCard';
import { InspectorNotFound } from '../inspector/InspectorNotFound';
import { InspectorOwnBadge } from '../inspector/InspectorOwnBadge';
import { InspectorProperty } from '../inspector/InspectorProperty';
import {
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_LINK_CLASS_NAME,
} from '../inspector/inspectorStyles';
import { ShowOnMapButton } from '../inspector/ShowOnMapButton';
import { NetworkInspectorSkeleton } from '../NetworkInspectorSkeleton';
import { OrganizationCardLogo } from './OrganizationCardLogo';
import { OrganizationProfileCard } from './OrganizationProfileCard';
import { OrganizationRequisites } from './OrganizationRequisites';

interface OrganizationCardBodyProps {
  card: OrganizationCardValue;
  cities: readonly NetworkMapCityValue[];
  isOwn: boolean;
  sites: readonly NetworkMapSiteValue[];
}

interface OrganizationInspectorProps {
  cities: readonly NetworkMapCityValue[];
  organizationId: string;
  sites: readonly NetworkMapSiteValue[];
}

const CITY_LINK_CLASS_NAME = cn(INSPECTOR_LINK_CLASS_NAME, 'inline-flex min-h-11 items-center');

const SITE_LINK_CLASS_NAME = [
  'flex min-h-16 items-center justify-between gap-2 rounded-control border border-line px-3 py-2',
  'motion-safe:transition-[background-color]',
  'hover:bg-hover active:bg-line',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

const OrganizationCardBody = ({ card, cities, isOwn, sites }: OrganizationCardBodyProps): ReactElement => {
  const { t } = useI18n();
  const profilesHeadingId = useId();
  const sitesHeadingId = useId();

  const cityNameByNodeId = useMemo(() => new Map(cities.map(city => [city.id, city.name])), [cities]);

  const isNameShown = sites.length === 0;
  const isSitesListShown = sites.length > 0;

  return (
    <div className="flex flex-col gap-4" data-object-type="organization" data-testid="network-inspector-body">
      <div className="flex flex-wrap items-center gap-2">
        <p className={INSPECTOR_KICKER_CLASS_NAME}>{t('object.type.organization')}</p>
        {isOwn && <InspectorOwnBadge label={t('organization.directory.ownLabel')} />}
      </div>
      {isNameShown && <p className="text-base leading-6 font-semibold text-on-panel" translate="no">{card.name}</p>}
      <OrganizationCardLogo logo={card.logo} />
      <section className="flex flex-col gap-2">
        <h3 className={INSPECTOR_KICKER_CLASS_NAME} id={profilesHeadingId}>
          {t('organization.directory.column.profiles')}
        </h3>
        <ul aria-labelledby={profilesHeadingId} className="flex flex-col gap-3">
          {card.profiles.map(profile => <OrganizationProfileCard key={profile.kind} profile={profile} />)}
        </ul>
      </section>
      <dl className="flex flex-col gap-3">
        <InspectorProperty label={t('organization.directory.column.spheres')}>
          {card.sphereNames.length === 0
            ? <span className="text-on-panel-muted">{t('organization.directory.noSpheres')}</span>
            : card.sphereNames.join(', ')}
        </InspectorProperty>
        <InspectorProperty label={t('organization.directory.column.cities')}>
          {cities.length === 0
            ? <span className="text-on-panel-muted">{t('organization.directory.noCities')}</span>
            : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {cities.map(city => (
                    <li key={city.id}>
                      <AddressLink
                        className={CITY_LINK_CLASS_NAME}
                        data-testid="organization-city-link"
                        to={{ kind: 'object', object: { id: city.id, type: 'city' } }}
                        translate="no"
                      >
                        {city.name}
                      </AddressLink>
                    </li>
                  ))}
                </ul>
              )}
        </InspectorProperty>
      </dl>
      {isSitesListShown && (
        <div className="flex flex-wrap gap-2 empty:hidden">
          <ShowOnMapButton isOrganization objectId={card.id} />
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm leading-5 font-semibold text-on-panel-muted" id={sitesHeadingId}>
          {t('organization.card.sites')}
          {' '}
          <span className="font-normal tabular-nums">{sites.length}</span>
        </h3>
        {isSitesListShown
          ? (
              <ul aria-labelledby={sitesHeadingId} className="flex flex-col gap-2">
                {sites.map(site => (
                  <li key={site.id}>
                    <AddressLink
                      className={SITE_LINK_CLASS_NAME}
                      data-site-id={site.id}
                      data-testid="organization-site-link"
                      to={{ kind: 'object', object: { id: site.id, type: 'site' } }}
                    >
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="block max-w-full truncate text-base leading-6 font-semibold text-on-panel" translate="no">
                          {site.label}
                        </span>
                        <span className="block max-w-full truncate text-sm leading-5 text-on-panel-muted" translate="no">
                          {cityNameByNodeId.get(site.nodeId)}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                    </AddressLink>
                  </li>
                ))}
              </ul>
            )
          : <p className="text-base text-on-panel-muted">{t('organization.directory.noCities')}</p>}
      </section>
      {isOwn && <OrganizationRequisites />}
    </div>
  );
};

export const OrganizationInspector = ({ cities, organizationId, sites }: OrganizationInspectorProps): ReactElement => {
  const { t } = useI18n();
  const { organizationId: actingOrganizationId } = useActingContext();
  const card = useOrganizationCard(organizationId);

  const isOwn = organizationId === actingOrganizationId;

  if (card.isNotFound) {
    return <InspectorNotFound />;
  }

  return (
    <WidgetStates
      data={card.data}
      error={card.error}
      isRetrying={card.isRetrying}
      loadingLabel={t('network.inspector.loading')}
      onRetry={card.retry}
      skeleton={<NetworkInspectorSkeleton isOwn={isOwn} kind="organization" />}
    >
      {data => <OrganizationCardBody card={data} cities={cities} isOwn={isOwn} sites={sites} />}
    </WidgetStates>
  );
};
