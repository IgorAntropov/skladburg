import { use } from 'react';

import type { AnnounceFunction } from './LiveRegionContext';

import { LiveRegionContext } from './LiveRegionContext';

export const useAnnounce = (): AnnounceFunction => {
  return use(LiveRegionContext);
};
