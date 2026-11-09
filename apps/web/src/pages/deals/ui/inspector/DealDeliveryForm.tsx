import type { ReactElement } from 'react';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealService } from '@skladburg/contracts/deal/v1/deal';

import { SelectField } from '@/shared/ui';

import type { DealEditorProps } from './dealInspectorTypes';

import { useChooseDealDeliveryForm } from '../../api/commands/useChooseDealDeliveryForm';
import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import { DealEditorForm } from './DealEditorForm';

export const DealDeliveryForm = ({ deal, isCurrentAction, onClose, onRefresh, onUpdated, t }: DealEditorProps): ReactElement => {
  const access = useDealCommandAccess(DealService.method.chooseDelivery);
  const form = useChooseDealDeliveryForm({ deal, onRefresh, onUpdated });
  const hasSupplierDelivery = deal.deliveryTotal !== undefined;

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      formTestId="deal-delivery-form"
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      label={t('dealInspector.deliverySave')}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitTestId="deal-delivery-submit"
      t={t}
      version={deal.version}
    >
      <SelectField {...form.getFieldProps('deliveryMethod')} isOptional={false} label={t('dealInspector.delivery')}>
        <option value="" />
        <option value={String(DeliveryMethod.CUSTOMER)}>{t('dealInspector.deliveryCustomer')}</option>
        {hasSupplierDelivery && <option value={String(DeliveryMethod.SUPPLIER)}>{t('dealInspector.deliverySupplier')}</option>}
      </SelectField>
    </DealEditorForm>
  );
};
