import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useViewportClass } from '@/shared/lib/viewport';

import type { NetworkMapModelStateValue } from '../../api/useNetworkMapModel';

import { NetworkMiniMapSlot } from '../NetworkMiniMapSlot';
import { NetworkSiteList } from './NetworkSiteList';

interface NetworkSitesPanelProps {
  focus: ObjectRefValue | undefined;
  state: NetworkMapModelStateValue;
}

export const NetworkSitesPanel = ({ focus, state }: NetworkSitesPanelProps): ReactElement => {
  const viewportClass = useViewportClass();

  const { data } = state;
  const isMiniMapShown = viewportClass === 'phone' && data !== undefined;

  return (
    <div className="flex flex-col gap-3">
      {isMiniMapShown && <NetworkMiniMapSlot focus={focus} model={data} />}
      <NetworkSiteList focus={focus} state={state} />
    </div>
  );
};
