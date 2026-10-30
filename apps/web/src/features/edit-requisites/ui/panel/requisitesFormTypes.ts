import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import type { RequisitesFormValues } from '../../model/requisitesFormValues';

export type RequisitesFieldBinder = (
  name: FormFieldPathValue<RequisitesFormValues>,
  options?: FormFieldOptionsValue,
) => FormFieldBindingValue;
