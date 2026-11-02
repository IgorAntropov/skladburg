import { createContext } from 'react';

import type { ListingTranslate } from '@/entities/listing';

import type { CatalogPageTranslate } from '../i18n/catalogSection';

export interface CatalogTextsValue {
  listingT: ListingTranslate;
  t: CatalogPageTranslate;
}

export const CatalogTextsContext = createContext<CatalogTextsValue | undefined>(undefined);
