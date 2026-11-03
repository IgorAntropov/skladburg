import type { Listing } from '@skladburg/contracts/catalog/v1/catalog';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import {
  SaveListingRequestFormRules,
  WarehouseAvailabilityFormRules,
} from '@skladburg/contracts/forms/catalog/v1/catalog';
import { useMemo } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import {
  expandRepeatedFormRules,
  useCommandForm,
} from '@/shared/lib/form';
import { useAnnounce } from '@/shared/ui';

import type { CatalogEditorTranslate } from '../../i18n/editor/editorSection';
import type {
  ListingFormOutputValue,
  ListingFormValues,
} from '../../lib/listingFormValues';

import {
  buildSaveListingCommand,
  remapAvailabilityPath,
} from '../../lib/buildSaveListingCommand';
import { getStockStatusPath } from '../../lib/fieldPaths';
import { toListingFormValues } from '../../lib/listingFormValues';
import { translateCatalogViolation } from '../../lib/translateCatalogViolation';

export interface UseSaveListingFormOptions {
  isUnitLocked: boolean;
  listing: Listing;
  onSaved: (saved: Listing) => void;
  t: CatalogEditorTranslate;
  warehouseIds: readonly string[];
}

export const useSaveListingForm = ({
  isUnitLocked,
  listing,
  onSaved,
  t,
  warehouseIds,
}: UseSaveListingFormOptions): CommandFormValue<ListingFormValues> => {
  const client = useApiClient();
  const announce = useAnnounce();

  const rules = useMemo(
    () => expandRepeatedFormRules(SaveListingRequestFormRules, 'availability', WarehouseAvailabilityFormRules, warehouseIds.length),
    [warehouseIds.length],
  );
  const watchedFields = useMemo(
    () => warehouseIds.map((_warehouseId, index) => getStockStatusPath(index)),
    [warehouseIds],
  );

  const execute = async (values: ListingFormOutputValue, idempotencyKey: string): Promise<Listing> => {
    const command = buildSaveListingCommand(values, { isUnitLocked, savedUnit: listing.priceUnit });
    const response = await client.service(CatalogService).saveListing({
      availability: command.availability,
      expectedVersion: listing.version,
      idempotencyKey,
      listingId: listing.id,
      minOrderQuantity: values.minOrderQuantity,
      orderStep: values.orderStep,
      priceUnit: command.priceUnit,
      productId: listing.productId,
      sphereIds: [...listing.sphereIds],
    });

    if (response.listing === undefined) {
      throw new Error('SaveListing response has no listing');
    }

    return response.listing;
  };

  const handleSaved = (saved: Listing): void => {
    console.log('> useSaveListingForm -> handleSaved:', { version: String(saved.version) });
    announce(t('catalogEditor.saved'));
    onSaved(saved);
  };

  const translateViolation = (ruleId: string): string | undefined => translateCatalogViolation(t, ruleId);

  return useCommandForm<ListingFormValues, Listing, ListingFormOutputValue>({
    defaultValues: toListingFormValues(listing, warehouseIds),
    execute,
    mapViolationPath: remapAvailabilityPath,
    method: CatalogService.method.saveListing,
    onSuccess: handleSaved,
    rules,
    translateViolation,
    watchedFields,
  });
};
