import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';

import type { CommandAccessValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';

interface CatalogImportAccessValue {
  readAccess: CommandAccessValue;
  writeAccess: CommandAccessValue;
}

export const useCatalogImportAccess = (): CatalogImportAccessValue => {
  const scope = { kind: 'organization' } as const;
  const catalogRead = useCommandAccess(CatalogService.method.listProducts, scope);
  const priceRead = useCommandAccess(CatalogService.method.listListingPrices, scope);
  const catalogWrite = useCommandAccess(CatalogService.method.saveProduct, scope);
  const priceWrite = useCommandAccess(CatalogService.method.saveListingPrice, scope);

  return {
    readAccess: catalogRead.status === 'allowed' ? priceRead : catalogRead,
    writeAccess: catalogWrite.status === 'allowed' ? priceWrite : catalogWrite,
  };
};
