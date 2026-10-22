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

import { SideBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import { formatCityTimeZone } from '../../lib/formatCityTimeZone';
import { InspectorProperty } from './InspectorProperty';
import { INSPECTOR_KICKER_CLASS_NAME } from './inspectorStyles';
import { ShowOnMapButton } from './ShowOnMapButton';

interface CityInspectorProps {
  city: NetworkMapCityValue;
  sites: readonly NetworkMapSiteValue[];
}

const SITE_LINK_CLASS_NAME = [
  'flex h-18 items-center justify-between gap-2 rounded-control border border-line px-3 py-2',
  'motion-safe:transition-[background-color]',
  'hover:bg-hover active:bg-line',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const CityInspector = ({ city, sites }: CityInspectorProps): ReactElement => {
  const { t } = useI18n();
  const headingId = useId();

  const timeZoneLabel = useMemo(() => formatCityTimeZone(city.timeZone), [city.timeZone]);

  const isListShown = sites.length > 0;

  return (
    <div className="flex flex-col gap-4" data-object-type="city" data-testid="network-inspector-body">
      <p className={INSPECTOR_KICKER_CLASS_NAME}>{t('object.type.city')}</p>
      <dl className="flex flex-col gap-3">
        <InspectorProperty label={t('network.inspector.timeZone')}>{timeZoneLabel}</InspectorProperty>
      </dl>
      <div className="flex flex-wrap gap-2 empty:hidden">
        <ShowOnMapButton objectId={city.id} />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm leading-5 font-semibold text-on-panel-muted" id={headingId}>
          {t('network.inspector.citySites')}
          {' '}
          <span className="font-normal tabular-nums">{sites.length}</span>
        </h3>
        {isListShown
          ? (
              <ul aria-labelledby={headingId} className="flex flex-col gap-2">
                {sites.map(site => (
                  <li key={site.id}>
                    <AddressLink
                      className={SITE_LINK_CLASS_NAME}
                      data-site-id={site.id}
                      data-testid="network-city-site-link"
                      to={{ kind: 'object', object: { id: site.id, type: 'site' } }}
                    >
                      <span className="flex min-w-0 flex-col items-start gap-1">
                        <span className="block max-w-full truncate text-base leading-6 font-semibold text-on-panel" translate="no">
                          {site.label}
                        </span>
                        <SideBadge side={site.side} />
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                    </AddressLink>
                  </li>
                ))}
              </ul>
            )
          : <p className="text-base text-on-panel-muted">{t('network.inspector.citySitesEmpty')}</p>}
      </section>
    </div>
  );
};
