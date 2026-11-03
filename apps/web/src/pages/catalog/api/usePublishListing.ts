import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';

import type { CommandAccessValue } from '@/shared/api';
import type { CommandValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import {
  useApiClient,
  useCommand,
} from '@/shared/api';

export interface PublishListingValue {
  access: CommandAccessValue;
  command: CommandValue;
}

export interface UsePublishListingOptions {
  listing: Listing;
  onPublished: (saved: Listing) => void;
}

export const usePublishListing = ({ listing, onPublished }: UsePublishListingOptions): PublishListingValue => {
  const client = useApiClient();
  const access = useCommandAccess(CatalogService.method.setListingPublished);

  const execute = async (idempotencyKey: string): Promise<Listing> => {
    const response = await client.service(CatalogService).setListingPublished({
      expectedVersion: listing.version,
      idempotencyKey,
      isPublished: !listing.isPublished,
      listingId: listing.id,
    });

    if (response.listing === undefined) {
      throw new Error('SetListingPublished response has no listing');
    }

    return response.listing;
  };

  const command = useCommand<Listing>({
    execute,
    method: CatalogService.method.setListingPublished,
    onSuccess: onPublished,
  });

  return { access, command };
};
