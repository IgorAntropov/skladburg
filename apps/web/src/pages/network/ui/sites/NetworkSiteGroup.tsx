import type { ReactElement } from 'react';

import { useId } from 'react';

import type { NetworkMapSiteValue } from '@/entities/network';

import { NetworkSiteRow } from './NetworkSiteRow';

interface NetworkSiteGroupProps {
  cityNameByNodeId: ReadonlyMap<string, string>;
  selectedSiteId: string | undefined;
  sites: readonly NetworkMapSiteValue[];
  title: string;
}

export const NetworkSiteGroup = ({
  cityNameByNodeId,
  selectedSiteId,
  sites,
  title,
}: NetworkSiteGroupProps): ReactElement => {
  const headingId = useId();

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm leading-5 font-semibold text-on-panel-muted" id={headingId}>
        {title}
        {' '}
        <span className="font-normal tabular-nums">{sites.length}</span>
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col gap-2">
        {sites.map(site => (
          <NetworkSiteRow
            cityName={cityNameByNodeId.get(site.nodeId) ?? ''}
            isSelected={site.id === selectedSiteId}
            key={site.id}
            site={site}
          />
        ))}
      </ul>
    </section>
  );
};
