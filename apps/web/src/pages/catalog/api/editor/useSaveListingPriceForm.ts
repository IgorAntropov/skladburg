import type { ListingPrice } from '@skladburg/contracts/catalog/v1/catalog';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import {
  PriceTierFormRules,
  SaveListingPriceRequestFormRules,
} from '@skladburg/contracts/forms/catalog/v1/catalog';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import {
  expandRepeatedFormRules,
  useCommandForm,
} from '@/shared/lib/form';
import { useAnnounce } from '@/shared/ui';

import type { CatalogEditorTranslate } from '../../i18n/editor/editorSection';
import type {
  PriceFormOutputValue,
  PriceFormValues,
} from '../../lib/listingFormValues';

import {
  buildTiers,
  collectTierIssues,
} from '../../lib/buildPriceTiers';
import {
  TIER_CAPACITY,
  toPriceFormValues,
} from '../../lib/listingFormValues';
import { translateCatalogViolation } from '../../lib/translateCatalogViolation';

export interface UseSaveListingPriceFormOptions {
  listingId: string;
  onSaved: (saved: ListingPrice) => void;
  price: ListingPrice | undefined;
  t: CatalogEditorTranslate;
  visibleCount: number;
}

const TIER_RULES = expandRepeatedFormRules(SaveListingPriceRequestFormRules, 'tiers', PriceTierFormRules, TIER_CAPACITY);

export const useSaveListingPriceForm = ({
  listingId,
  onSaved,
  price,
  t,
  visibleCount,
}: UseSaveListingPriceFormOptions): CommandFormValue<PriceFormValues> => {
  const client = useApiClient();
  const announce = useAnnounce();

  const execute = async (values: PriceFormOutputValue, idempotencyKey: string): Promise<ListingPrice> => {
    const response = await client.service(CatalogService).saveListingPrice({
      expectedVersion: price?.version ?? 0n,
      idempotencyKey,
      listingId,
      tiers: buildTiers(values, visibleCount),
    });

    if (response.price === undefined) {
      throw new Error('SaveListingPrice response has no price');
    }

    return response.price;
  };

  const handleSaved = (saved: ListingPrice): void => {
    console.log('> useSaveListingPriceForm -> handleSaved:', { version: String(saved.version) });
    announce(t('catalogEditor.price.saved'));
    onSaved(saved);
  };

  const validateValues = (values: PriceFormOutputValue): readonly FormFieldIssueValue[] => collectTierIssues(values, visibleCount);

  const translateViolation = (ruleId: string): string | undefined => translateCatalogViolation(t, ruleId);

  return useCommandForm<PriceFormValues, ListingPrice, PriceFormOutputValue>({
    defaultValues: toPriceFormValues(price),
    execute,
    method: CatalogService.method.saveListingPrice,
    onSuccess: handleSaved,
    rules: TIER_RULES,
    translateViolation,
    validateValues,
  });
};
