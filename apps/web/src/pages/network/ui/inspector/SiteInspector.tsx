import type { ReactElement } from 'react';

import { House } from 'lucide-react';
import { useMemo } from 'react';

import type {
  NetworkMapCityValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import { formatCityTimeZone } from '../../lib/formatCityTimeZone';
import { SideBadge } from '../SideBadge';
import { InspectorProperty } from './InspectorProperty';
import {
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_LINK_CLASS_NAME,
} from './inspectorStyles';
import { OpenWarehouseButton } from './OpenWarehouseButton';
import { OwnSiteAddress } from './OwnSiteAddress';

interface SiteInspectorProps {
  city: NetworkMapCityValue;
  site: NetworkMapSiteValue;
}

const OWN_BADGE_CLASS_NAME = [
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-hover px-2.5 py-0.5',
  'text-sm leading-5 font-medium text-on-panel',
].join(' ');

export const SiteInspector = ({ city, site }: SiteInspectorProps): ReactElement => {
  const { t } = useI18n();
  const timeZoneLabel = useMemo(() => formatCityTimeZone(city.timeZone), [city.timeZone]);

  return (
    <div className="flex flex-col gap-4" data-object-type="site" data-testid="network-inspector-body">
      <div className="flex flex-wrap items-center gap-2">
        <p className={INSPECTOR_KICKER_CLASS_NAME}>{t('object.type.site')}</p>
        <SideBadge side={site.side} />
        {site.isOwn && (
          <span className={OWN_BADGE_CLASS_NAME}>
            <House aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
            {t('network.inspector.own')}
          </span>
        )}
      </div>
      <dl className="flex flex-col gap-3">
        <InspectorProperty label={t('network.inspector.city')}>
          <AddressLink
            className={INSPECTOR_LINK_CLASS_NAME}
            data-testid="network-inspector-city-link"
            to={{ kind: 'object', object: { id: city.id, type: 'city' } }}
            translate="no"
          >
            {city.name}
          </AddressLink>
        </InspectorProperty>
        <InspectorProperty label={t('network.inspector.timeZone')}>{timeZoneLabel}</InspectorProperty>
        {site.isOwn && <OwnSiteAddress warehouseId={site.id} />}
      </dl>
      {site.isOwn && <OpenWarehouseButton warehouseId={site.id} />}
    </div>
  );
};
