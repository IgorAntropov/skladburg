import type { ReactElement } from 'react';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { useState } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  createMoneyMask,
  createWholeNumberMask,
} from '@/shared/lib/mask';
import {
  DateField,
  TextField,
} from '@/shared/ui';

import type { DealEditorProps } from './dealInspectorTypes';

import { useCounterDealForm } from '../../api/commands/useCounterDealForm';
import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import { useDealWarehouseOptions } from '../../api/commands/useDealWarehouseOptions';
import { DealEditorForm } from './DealEditorForm';
import {
  getDealLinePricePath,
  getDealLineQuantityPath,
} from './dealFieldPaths';
import {
  dealLinePriceBasis,
  dealLineUnit,
} from './dealLineLabels';
import { DealWarehouseField } from './DealWarehouseField';

export const CounterDealForm = ({ deal, isCurrentAction, onClose, onRefresh, onUpdated, t }: DealEditorProps): ReactElement => {
  const { locale } = useI18n();
  const access = useDealCommandAccess(DealService.method.counterDeal);
  const query = useDealWarehouseOptions(deal.shipFromCityId);
  const [initial] = useState(deal);
  const [moneyMask] = useState(createMoneyMask);
  const [quantityMask] = useState(createWholeNumberMask);
  const form = useCounterDealForm({ deal, initial, onRefresh, onUpdated });
  const format = new Intl.NumberFormat(locale);

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      formTestId="deal-counter-form"
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      isDisabled={!query.data?.length}
      label={t('dealInspector.counterSave')}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitTestId="deal-counter-submit"
      t={t}
      version={deal.version}
    >
      {initial.lines.map((line, index) => (
        <fieldset className="flex min-w-0 flex-col gap-2" key={line.id}>
          <legend className="mb-2 font-medium wrap-break-word">{line.productSnapshot?.name}</legend>
          <div data-testid={`deal-counter-quantity-${String(index)}`}>
            <TextField
              {...form.getFieldProps(getDealLineQuantityPath(index), { mask: quantityMask })}
              isOptional={false}
              label={t('dealInspector.quantity', { unit: dealLineUnit(line, t) })}
            />
          </div>
          <div data-testid={`deal-counter-price-${String(index)}`}>
            <TextField
              {...form.getFieldProps(getDealLinePricePath(index), { mask: moneyMask })}
              isOptional={false}
              label={t('dealInspector.price', { unit: dealLinePriceBasis(line, format, t) })}
            />
          </div>
        </fieldset>
      ))}
      <div data-testid="deal-counter-date">
        <DateField {...form.getFieldProps('desiredDate')} label={t('dealInspector.date')} />
      </div>
      <DealWarehouseField
        field={form.getFieldProps('shipFromWarehouseId')}
        label={t('dealInspector.shipFrom')}
        query={query}
        t={t}
        testId="deal-counter-warehouse"
      />
      <TextField {...form.getFieldProps('reason')} label={t('dealInspector.reason')} />
    </DealEditorForm>
  );
};
