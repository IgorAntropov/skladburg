import { use } from 'react';

import type { CatalogTextsValue } from './catalogTextsContext';

import { CatalogTextsContext } from './catalogTextsContext';

export const useCatalogTexts = (): CatalogTextsValue => {
  const texts = use(CatalogTextsContext);

  if (texts === undefined) {
    throw new Error('useCatalogTexts must be used inside CatalogTextsGate');
  }

  return texts;
};
