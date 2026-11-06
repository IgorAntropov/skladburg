import type { ReactElement } from 'react';

import type { FormFieldBindingValue } from '@/shared/lib/form';

import {
  SelectField,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { DealWarehouseOptionsValue } from '../../api/commands/useDealWarehouseOptions';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

interface DealWarehouseFieldProps {
  field: FormFieldBindingValue;
  label: string;
  query: DealWarehouseOptionsValue;
  t: DealInspectorTranslate;
  testId?: string | undefined;
}

export const DealWarehouseField = ({ field, label, query, t, testId }: DealWarehouseFieldProps): ReactElement => {
  return (
    <div data-testid={testId}>
      <WidgetStates
        data={query.data}
        error={query.error}
        isRetrying={query.isFetching}
        loadingLabel={t('dealInspector.loading')}
        onRetry={query.retry}
        skeleton={<Skeleton shape="block" />}
      >
        {warehouses => (
          <>
            <SelectField {...field} isOptional={false} label={label}>
              <option value="" />
              {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </SelectField>
            {warehouses.length === 0 && <p className="mt-2 text-sm text-on-panel-muted">{t('dealInspector.warehouseEmpty')}</p>}
          </>
        )}
      </WidgetStates>
    </div>
  );
};
