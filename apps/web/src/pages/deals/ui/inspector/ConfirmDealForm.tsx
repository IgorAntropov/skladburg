import type { ReactElement } from 'react';

import { DealService } from '@skladburg/contracts/deal/v1/deal';

import type { DealEditorProps } from './dealInspectorTypes';

import { useConfirmDealForm } from '../../api/commands/useConfirmDealForm';
import { useDealApprovalAccess } from '../../api/commands/useDealCommandAccess';
import { useDealWarehouseOptions } from '../../api/commands/useDealWarehouseOptions';
import { DealEditorForm } from './DealEditorForm';
import { DealLimitReason } from './DealLimitReason';
import { DealWarehouseField } from './DealWarehouseField';

export const ConfirmDealForm = ({ deal, isCurrentAction, onClose, onRefresh, onUpdated, t }: DealEditorProps): ReactElement => {
  const { access, limit } = useDealApprovalAccess(DealService.method.confirmDeal, deal.goodsTotal);
  const query = useDealWarehouseOptions(deal.shipFromCityId);
  const form = useConfirmDealForm({ deal, onRefresh, onUpdated });

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      isDisabled={deal.goodsTotal === undefined || limit !== undefined || !query.data?.length}
      label={t('dealInspector.confirm')}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitTestId="deal-confirm-submit"
      t={t}
      version={deal.version}
    >
      <DealWarehouseField field={form.getFieldProps('shipFromWarehouseId')} label={t('dealInspector.shipFrom')} query={query} t={t} />
      <DealLimitReason amount={deal.goodsTotal} limit={limit} t={t} />
    </DealEditorForm>
  );
};
