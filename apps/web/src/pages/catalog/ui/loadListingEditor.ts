import { createCachedModuleLoader } from '@/shared/lib/module-loader';

export const loadListingEditor = createCachedModuleLoader(() => import('./listing-editor/ListingEditor'));
