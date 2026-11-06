import type { ReactElement } from 'react';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { useState } from 'react';

import {
  useMapSitesQuery,
  useNetworkDirectoryQuery,
} from '@/entities/network';
import { createWholeNumberMask } from '@/shared/lib/mask';
import {
  DateField,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { DealEditorProps } from './dealInspectorTypes';

import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import { useDealWarehouseOptions } from '../../api/commands/useDealWarehouseOptions';
import { useUpdateDealDraftForm } from '../../api/commands/useUpdateDealDraftForm';
import { DealEditorForm } from './DealEditorForm';
import { getDealLineQuantityPath } from './dealFieldPaths';
import { dealLineUnit } from './dealLineLabels';
import { DealWarehouseField } from './DealWarehouseField';

export const DealDraftForm = ({ deal, isCurrentAction, onClose, onRefresh, onUpdated, t }: DealEditorProps): ReactElement => {
  const access = useDealCommandAccess(DealService.method.updateDealDraft);
  const directory = useNetworkDirectoryQuery();
  const mapSites = useMapSitesQuery();
  const query = useDealWarehouseOptions(undefined);
  const [initial] = useState(deal);
  const [quantityMask] = useState(createWholeNumberMask);
  const form = useUpdateDealDraftForm({ deal, initial, onRefresh, onUpdated });

  const cityIds = new Set([
    deal.shipFromCityId,
    initial.shipFromCityId,
    ...(mapSites.data ?? []).filter(site => site.organizationId === deal.supplierOrganizationId).map(site => site.cityId),
  ]);
  const cities = directory.data?.cities.filter(city => cityIds.has(city.id)) ?? [];

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      isDisabled={!query.data?.length}
      label={t('dealInspector.save')}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      t={t}
      version={deal.version}
    >
      {initial.lines.map((line, index) => (
        <fieldset className="min-w-0" key={line.id}>
          <legend className="mb-2 font-medium wrap-break-word">{line.productSnapshot?.name}</legend>
          <TextField
            {...form.getFieldProps(getDealLineQuantityPath(index), { mask: quantityMask })}
            isOptional={false}
            label={t('dealInspector.quantity', { unit: dealLineUnit(line, t) })}
          />
        </fieldset>
      ))}
      <DateField {...form.getFieldProps('desiredDate')} label={t('dealInspector.date')} />
      <SelectField {...form.getFieldProps('shipFromCityId')} isOptional={false} label={t('dealInspector.shipCity')}>
        {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
      </SelectField>
      <DealWarehouseField field={form.getFieldProps('shipToWarehouseId')} label={t('dealInspector.shipTo')} query={query} t={t} />
    </DealEditorForm>
  );
};
