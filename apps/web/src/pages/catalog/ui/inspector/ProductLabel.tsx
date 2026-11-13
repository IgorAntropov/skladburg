import type { ReactElement } from 'react';

import type { PrintPageValue } from '@/features/print-labels';

import { PrintLabels } from '@/features/print-labels';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { useCatalogTexts } from '../../model/useCatalogTexts';

interface ProductLabelProps {
  pair: OwnListingPairValue;
}

const ProductLabel = ({ pair: { listing, product } }: ProductLabelProps): ReactElement => {
  const { t } = useCatalogTexts();

  const getPages = (): PrintPageValue[] => [{
    code: product.id,
    details: [t('catalog.own.sku', { sku: product.sku }), listing.priceUnit?.name ?? ''].filter(line => line !== ''),
    heading: product.name,
    kind: 'item',
  }];

  return <PrintLabels getPages={getPages} label={t('catalog.own.printLabel')} testId="product-print-label" />;
};

export default ProductLabel;
