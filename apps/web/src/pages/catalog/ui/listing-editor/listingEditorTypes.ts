import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import type {
  ListingFormValues,
  PriceFormValues,
} from '../../lib/listingFormValues';
import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

export interface ListingEditorProps {
  onClose: () => void;
  pair: OwnListingPairValue;
}

export type ListingFieldBinder = (
  name: FormFieldPathValue<ListingFormValues>,
  options?: FormFieldOptionsValue,
) => FormFieldBindingValue;

export type PriceFieldBinder = (
  name: FormFieldPathValue<PriceFormValues>,
  options?: FormFieldOptionsValue,
) => FormFieldBindingValue;
