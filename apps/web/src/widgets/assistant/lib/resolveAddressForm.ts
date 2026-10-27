import { AssistantAddressForm } from '@skladburg/contracts/organization/v1/organization';

export type AssistantAddressFormValue = 'formal' | 'informal';

export const resolveAddressForm = (form: AssistantAddressForm | undefined): AssistantAddressFormValue => {
  return form === AssistantAddressForm.INFORMAL ? 'informal' : 'formal';
};
