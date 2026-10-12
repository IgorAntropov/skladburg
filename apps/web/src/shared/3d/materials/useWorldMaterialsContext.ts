import { use } from 'react';

import type { WorldMaterialsContextValue } from './WorldMaterialsContext';

import { WorldMaterialsContext } from './WorldMaterialsContext';

export const useWorldMaterialsContext = (): WorldMaterialsContextValue => {
  const context = use(WorldMaterialsContext);

  if (context === undefined) {
    throw new Error('World materials are available only inside WorldMaterialsProvider');
  }

  return context;
};
