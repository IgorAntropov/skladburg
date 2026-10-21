import type {
  PointerEvent,
  ReactElement,
} from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import type { NetworkMapSiteValue } from '@/entities/network';

import { AddressLink } from '@/shared/routing';

import { resolveScrollBehavior } from '../../lib/resolveScrollBehavior';
import { useNetworkMapStore } from '../../model/useNetworkMapStore';
import { SideBadge } from '../SideBadge';

interface NetworkSiteRowProps {
  cityName: string;
  isSelected: boolean;
  site: NetworkMapSiteValue;
}

const ROW_CLASS_NAME = [
  'flex h-18 w-full cursor-pointer touch-manipulation flex-col gap-1 rounded-control border border-line px-3 py-2 text-left',
  'motion-safe:transition-[background-color,border-color]',
  'hover:bg-hover active:bg-line',
  'aria-[current=true]:border-indicator aria-[current=true]:bg-hover aria-[current=true]:ring-1 aria-[current=true]:ring-indicator',
  'aria-[current=true]:ring-inset aria-[current=true]:active:bg-line',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
].join(' ');

export const NetworkSiteRow = ({ cityName, isSelected, site }: NetworkSiteRowProps): ReactElement => {
  const setHoveredId = useNetworkMapStore(state => state.setHoveredId);
  const clearHoveredId = useNetworkMapStore(state => state.clearHoveredId);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const handlePointerEnter = (event: PointerEvent<HTMLAnchorElement>): void => {
    console.log('> NetworkSiteRow -> handlePointerEnter:', { pointerType: event.pointerType, siteId: site.id });

    if (event.pointerType !== 'touch') {
      setHoveredId(site.id);
    }
  };

  const handlePointerLeave = (): void => {
    console.log('> NetworkSiteRow -> handlePointerLeave:', { siteId: site.id });
    clearHoveredId(site.id);
  };

  const handleFocus = (): void => {
    console.log('> NetworkSiteRow -> handleFocus:', { siteId: site.id });
    setHoveredId(site.id);
  };

  const handleBlur = (): void => {
    console.log('> NetworkSiteRow -> handleBlur:', { siteId: site.id });
    clearHoveredId(site.id);
  };

  useEffect(() => {
    if (isSelected) {
      linkRef.current?.scrollIntoView({ behavior: resolveScrollBehavior(), block: 'nearest' });
    }
  }, [isSelected]);

  useEffect(() => () => {
    clearHoveredId(site.id);
  }, [clearHoveredId, site.id]);

  return (
    <li>
      <AddressLink
        aria-current={isSelected ? 'true' : undefined}
        className={ROW_CLASS_NAME}
        data-site-id={site.id}
        data-testid="network-site-row"
        onBlur={handleBlur}
        onFocus={handleFocus}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        ref={linkRef}
        to={{ kind: 'object', object: { id: site.id, type: 'site' } }}
      >
        <span className="block truncate text-base leading-6 font-semibold text-on-panel" translate="no">{site.label}</span>
        <span className="flex min-w-0 items-center gap-2">
          <SideBadge side={site.side} />
          <span className="truncate text-sm leading-5 text-on-panel-muted" translate="no">{cityName}</span>
        </span>
      </AddressLink>
    </li>
  );
};
