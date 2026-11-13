import type { ReactElement } from 'react';

import { PublicationBadge } from '@/entities/listing';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { LISTING_EDIT_FOCUS_KEY } from '../../model/editFocusKeys';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditLauncher } from '../../model/useEditLauncher';
import { EditLauncherButton } from '../EditLauncherButton';
import { loadListingEditor } from '../loadListingEditor';
import { INSPECTOR_KICKER_CLASS_NAME } from './inspectorStyles';
import { ListingAbout } from './ListingAbout';
import { OwnListingParams } from './OwnListingParams';
import { OwnListingStock } from './OwnListingStock';
import { OwnListingTiers } from './OwnListingTiers';
import ProductLabel from './ProductLabel';

interface OwnListingDetailsProps {
  pair: OwnListingPairValue;
}

export const OwnListingDetails = ({ pair }: OwnListingDetailsProps): ReactElement => {
  const { t } = useCatalogTexts();
  const launcher = useEditLauncher(loadListingEditor, LISTING_EDIT_FOCUS_KEY);

  const { listing, product } = pair;
  const ListingEditor = launcher.module?.ListingEditor;

  if (ListingEditor !== undefined) {
    return <ListingEditor onClose={launcher.close} pair={pair} />;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="listing-own">
      <div className="flex flex-wrap items-center gap-2">
        <span className={INSPECTOR_KICKER_CLASS_NAME}>{t('catalog.own.kicker')}</span>
        <PublicationBadge isPublished={listing.isPublished} />
      </div>
      <EditLauncherButton
        data-testid="listing-edit"
        failureMessage={t('catalog.editor.openError')}
        label={t('catalog.own.edit')}
        launcher={launcher}
        variant="primary"
      />
      {product.gtin === '' && <ProductLabel pair={pair} />}
      <OwnListingTiers pair={pair} />
      <OwnListingStock pair={pair} />
      <OwnListingParams pair={pair} />
      <ListingAbout
        listing={{
          baseUnit: product.baseUnit,
          gtin: product.gtin,
          packagings: product.packagings,
          priceUnit: listing.priceUnit,
          shelfLifeDays: product.shelfLifeDays,
          storageTemperature: product.storageTemperature,
          vatRate: product.vatRate,
        }}
        sku={product.sku}
      />
    </div>
  );
};
