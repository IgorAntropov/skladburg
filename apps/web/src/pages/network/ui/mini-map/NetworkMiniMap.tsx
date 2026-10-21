import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type {
  NetworkMapModelValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { orderMiniMapCities } from '../../lib/orderMiniMapCities';
import { projectMiniMap } from '../../lib/projectMiniMap';
import { MiniMapCityMarker } from './MiniMapCityMarker';

interface NetworkMiniMapProps {
  model: NetworkMapModelValue;
  selectedCityId: string | undefined;
}

const PADDING_FRACTION = 0.07;

const PERCENT = 100;

export const NetworkMiniMap = ({ model, selectedCityId }: NetworkMiniMapProps): ReactElement => {
  const { t } = useI18n();

  const projection = useMemo(() => projectMiniMap(model, PADDING_FRACTION), [model]);
  const orderedPoints = useMemo(() => orderMiniMapCities(projection.cities), [projection.cities]);
  const cityById = useMemo(() => new Map(model.cities.map(city => [city.id, city])), [model.cities]);
  const sitesByNodeId = useMemo(() => {
    const grouped = new Map<string, NetworkMapSiteValue[]>();

    for (const site of model.sites) {
      grouped.set(site.nodeId, [...grouped.get(site.nodeId) ?? [], site]);
    }

    return grouped;
  }, [model.sites]);

  const selectedCity = selectedCityId === undefined ? undefined : cityById.get(selectedCityId);
  const selectedCityCount = selectedCity === undefined ? 0 : sitesByNodeId.get(selectedCity.id)?.length ?? 0;

  return (
    <div aria-label={t('network.miniMap.label')} className="flex flex-col gap-2" data-testid="network-mini-map" role="group">
      <div
        className="relative max-h-55 min-h-40 w-full rounded-control border border-line bg-hover"
        style={{ aspectRatio: projection.aspectRatio }}
      >
        <svg aria-hidden className="absolute inset-0 size-full" focusable="false" preserveAspectRatio="none" viewBox="0 0 100 100">
          {projection.roads.map(road => (
            <line
              className="stroke-line-strong"
              key={road.id}
              strokeLinecap="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              x1={road.from.x * PERCENT}
              x2={road.to.x * PERCENT}
              y1={road.from.y * PERCENT}
              y2={road.to.y * PERCENT}
            />
          ))}
        </svg>
        {orderedPoints.map((point) => {
          const city = cityById.get(point.id);

          if (city === undefined) {
            return null;
          }

          return (
            <MiniMapCityMarker
              city={city}
              isSelected={point.id === selectedCityId}
              key={point.id}
              point={point}
              sites={sitesByNodeId.get(point.id) ?? []}
            />
          );
        })}
      </div>
      <p className={cn('min-h-5 text-sm leading-5', selectedCity === undefined ? 'text-on-panel-muted' : 'font-semibold text-on-panel')}>
        {selectedCity === undefined
          ? t('network.miniMap.hint')
          : t('network.miniMap.city', { city: selectedCity.name, count: selectedCityCount })}
      </p>
    </div>
  );
};
