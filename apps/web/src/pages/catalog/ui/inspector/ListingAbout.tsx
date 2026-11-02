import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useI18n } from '@/shared/i18n';

import { describeVat } from '../../lib/describeVat';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { formatTemperatureRange } from '../../lib/formatTemperatureRange';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  INSPECTOR_HEADING_CLASS_NAME,
  INSPECTOR_SECTION_TITLE_CLASS_NAME,
  INSPECTOR_VALUE_CLASS_NAME,
} from './inspectorStyles';

interface AboutPropertyProps {
  children: ReactNode;
  label: string;
}

interface ListingAboutProps {
  listing: ShowcaseListing;
}

const AboutProperty = ({ children, label }: AboutPropertyProps): ReactElement => (
  <div>
    <dt className={INSPECTOR_SECTION_TITLE_CLASS_NAME}>{label}</dt>
    <dd className={INSPECTOR_VALUE_CLASS_NAME}>{children}</dd>
  </div>
);

export const ListingAbout = ({ listing }: ListingAboutProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT } = useCatalogTexts();

  const storageText = formatTemperatureRange(listing.storageTemperature);
  const vat = describeVat(listing.vatRate);
  const packagings = listing.packagings.flatMap((packaging) => {
    const quantityText = formatListingQuantity(locale, listing, packaging.baseQuantity, listingT);

    if (quantityText === undefined) {
      return [];
    }

    return [{ key: `${packaging.name}:${packaging.baseQuantity.toString()}`, name: packaging.name, quantityText }];
  });

  return (
    <section className="flex flex-col gap-3" data-testid="listing-about">
      <h3 className={INSPECTOR_HEADING_CLASS_NAME}>{listingT('listing.about.title')}</h3>
      <dl className="flex flex-col gap-3">
        {packagings.length > 0 && (
          <AboutProperty label={listingT('listing.about.packaging')}>
            {packagings.map(packaging => (
              <span className="block" key={packaging.key}>
                {listingT('listing.about.packagingItem', { name: packaging.name, quantity: packaging.quantityText })}
              </span>
            ))}
          </AboutProperty>
        )}
        {listing.shelfLifeDays > 0 && (
          <AboutProperty label={listingT('listing.about.shelfLife')}>
            {listingT('listing.about.shelfLifeValue', { count: listing.shelfLifeDays })}
          </AboutProperty>
        )}
        {storageText !== undefined && <AboutProperty label={listingT('listing.about.storage')}>{storageText}</AboutProperty>}
        {vat !== undefined && (
          <AboutProperty label={listingT('listing.about.vat')}>
            {vat.kind === 'none' ? listingT('listing.about.vatNone') : listingT('listing.about.vatRate', { rate: vat.percent })}
          </AboutProperty>
        )}
        {listing.gtin !== '' && (
          <AboutProperty label={listingT('listing.about.gtin')}>
            <span translate="no">{listing.gtin}</span>
          </AboutProperty>
        )}
      </dl>
    </section>
  );
};
