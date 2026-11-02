import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { ReactElement } from 'react';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import {
  AvailabilityBadge,
  pickBestAvailability,
} from '@/entities/listing';
import { ProfileBadge } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import {
  TextLink,
  WidgetStates,
} from '@/shared/ui';

import type { ListingInspectorStateValue } from '../../api/useListingInspectorState';

import { useCatalogTexts } from '../../model/useCatalogTexts';
import { ListingInspectorSkeleton } from '../ListingInspectorSkeleton';
import {
  INSPECTOR_KICKER_CLASS_NAME,
  INSPECTOR_SECTION_TITLE_CLASS_NAME,
  INSPECTOR_VALUE_CLASS_NAME,
} from './inspectorStyles';
import { ListingAbout } from './ListingAbout';
import { ListingCityList } from './ListingCityList';
import { ListingNotFound } from './ListingNotFound';
import { ListingQuoteBlock } from './ListingQuoteBlock';
import { ListingTiersTable } from './ListingTiersTable';

interface ListingDetailsProps {
  listing: ShowcaseListing;
  state: ListingInspectorStateValue;
}

interface ListingInspectorBodyProps {
  state: ListingInspectorStateValue;
}

const ListingDetails = ({ listing, state }: ListingDetailsProps): ReactElement => {
  const { t } = useI18n();
  const { listingT } = useCatalogTexts();

  const { supplier } = listing;
  const availability = pickBestAvailability(listing.cityAvailability);
  const [quote] = listing.quotes;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={INSPECTOR_KICKER_CLASS_NAME}>{t('object.type.listing')}</span>
        {availability !== undefined && <AvailabilityBadge status={availability} />}
      </div>
      {supplier !== undefined && (
        <dl>
          <dt className={INSPECTOR_SECTION_TITLE_CLASS_NAME}>{listingT('listing.supplier')}</dt>
          <dd className={INSPECTOR_VALUE_CLASS_NAME}>
            <TextLink to={{ kind: 'object', object: { id: supplier.organizationId, type: 'organization' } }} translate="no">
              {supplier.name}
            </TextLink>
            <div className="mt-2">
              <ProfileBadge kind={ProfileKind.SUPPLIER} level={supplier.verificationLevel} />
            </div>
          </dd>
        </dl>
      )}
      <ListingQuoteBlock cityNames={state.cityNames} destination={state.destination} listing={listing} />
      <ListingTiersTable listing={listing} quote={quote} />
      <ListingCityList cityNames={state.cityNames} listing={listing} />
      <ListingAbout listing={listing} />
    </div>
  );
};

export const ListingInspectorBody = ({ state }: ListingInspectorBodyProps): ReactElement => {
  const { listingT } = useCatalogTexts();

  if (state.isNotFound) {
    return <ListingNotFound />;
  }

  return (
    <WidgetStates
      data={state.listing}
      error={state.error}
      isRetrying={state.isRetrying}
      loadingLabel={listingT('listing.loading')}
      onRetry={state.retry}
      skeleton={<ListingInspectorSkeleton />}
    >
      {listing => <ListingDetails listing={listing} state={state} />}
    </WidgetStates>
  );
};
