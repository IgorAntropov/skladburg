import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type {
  NetworkMapCityValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { SideBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import { formatCityTimeZone } from '../../lib/formatCityTimeZone';
import { InspectorOwnBadge } from './InspectorOwnBadge';
import { InspectorProperty } from './InspectorProperty';
import {
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_LINK_CLASS_NAME,
} from './inspectorStyles';
import { OpenWarehouseButton } from './OpenWarehouseButton';
import { OwnSiteAddress } from './OwnSiteAddress';
import { ShowOnMapButton } from './ShowOnMapButton';

interface SiteInspectorProps {
  city: NetworkMapCityValue;
  site: NetworkMapSiteValue;
}

export const SiteInspector = ({ city, site }: SiteInspectorProps): ReactElement => {
  const { t } = useI18n();
  const timeZoneLabel = useMemo(() => formatCityTimeZone(city.timeZone), [city.timeZone]);

  return (
    <div className="flex flex-col gap-4" data-object-type="site" data-testid="network-inspector-body">
      <div className="flex flex-wrap items-center gap-2">
        <p className={INSPECTOR_KICKER_CLASS_NAME}>{t('object.type.site')}</p>
        <SideBadge side={site.side} />
        {site.isOwn && <InspectorOwnBadge label={t('network.inspector.own')} />}
      </div>
      <dl className="flex flex-col gap-3">
        <InspectorProperty label={t('network.inspector.company')}>
          <AddressLink
            className={INSPECTOR_LINK_CLASS_NAME}
            data-testid="network-inspector-company-link"
            to={{ kind: 'object', object: { id: site.organizationId, type: 'organization' } }}
            translate="no"
          >
            {site.organizationName}
          </AddressLink>
        </InspectorProperty>
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
      <div className="flex flex-wrap gap-2 empty:hidden">
        {site.isOwn && <OpenWarehouseButton warehouseId={site.id} />}
        <ShowOnMapButton objectId={site.id} />
      </div>
    </div>
  );
};
