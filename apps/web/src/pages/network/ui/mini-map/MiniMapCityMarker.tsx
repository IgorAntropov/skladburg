import type { ReactElement } from 'react';

import type {
  NetworkMapCityValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import { SideShape } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { AddressLink } from '@/shared/routing';

import type { MiniMapPointValue } from '../../lib/projectMiniMap';

import { listCitySides } from '../../lib/listCitySides';

interface MiniMapCityMarkerProps {
  city: NetworkMapCityValue;
  isSelected: boolean;
  point: MiniMapPointValue;
  sites: readonly NetworkMapSiteValue[];
}

const PERCENT = 100;

const toPercent = (fraction: number): string => `${(fraction * PERCENT).toFixed(2)}%`;

const PLATE_WIDTH_CLASS_NAMES: Readonly<Record<number, string>> = {
  0: 'w-6',
  1: 'w-6',
  2: 'w-9',
  3: 'w-11.5',
};

const MARKER_CLASS_NAME = [
  'group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center',
  'rounded-full focus-visible:outline-hidden',
].join(' ');

const PLATE_CLASS_NAME = [
  'relative flex h-6 items-center justify-center rounded-full bg-panel-solid',
  'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus',
  'group-active:bg-hover',
].join(' ');

const ARROW_CLASS_NAME = [
  'pointer-events-none absolute top-[calc(50%+13px)] left-1/2 -translate-x-1/2',
  'border-x-4 border-t-5 border-x-transparent border-t-indicator',
].join(' ');

export const MiniMapCityMarker = ({
  city,
  isSelected,
  point,
  sites,
}: MiniMapCityMarkerProps): ReactElement => {
  const { t } = useI18n();

  const sides = listCitySides(sites);
  const isEmptyCity = sides.length === 0;

  return (
    <AddressLink
      aria-current={isSelected ? 'true' : undefined}
      aria-label={t('network.miniMap.city', { city: city.name, count: sites.length })}
      className={MARKER_CLASS_NAME}
      data-city-id={city.id}
      data-testid="network-mini-map-city"
      style={{ left: toPercent(point.x), top: toPercent(point.y) }}
      to={{ kind: 'object', object: { id: city.id, type: 'city' } }}
    >
      <span
        aria-hidden
        className={cn(
          PLATE_CLASS_NAME,
          PLATE_WIDTH_CLASS_NAMES[sides.length],
          isSelected ? 'border-2 border-indicator' : 'border border-line-strong',
        )}
      >
        {isEmptyCity && <span className="size-2.5 rounded-full border-2 border-line-strong" />}
        {sides.map((side, index) => (
          <SideShape className={cn('size-4', index > 0 && sides.length === 3 && '-ml-[3px]')} key={side} side={side} />
        ))}
      </span>
      {isSelected && <span aria-hidden className={ARROW_CLASS_NAME} />}
    </AddressLink>
  );
};
