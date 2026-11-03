import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import type { InputMaskValue } from '@/shared/lib/mask';

import {
  SelectField,
  TextField,
} from '@/shared/ui';

import type { ListingFieldBinder } from './listingEditorTypes';

import {
  getStockQuantityPath,
  getStockStatusPath,
} from '../../lib/fieldPaths';
import { NOT_SHIPPED_STATUS_VALUE } from '../../lib/listingFormValues';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditorTexts } from '../../model/useEditorTexts';

interface ListingStockRowProps {
  bind: ListingFieldBinder;
  index: number;
  isLast: boolean;
  isNotShipped: boolean;
  onStatusChange: (index: number, status: string) => void;
  quantityMask: InputMaskValue;
  title: string;
  unitName: string;
  warehouseId: string;
}

const STATUS_OPTIONS = [
  { labelKey: 'listing.availability.inStock', value: AvailabilityStatus.IN_STOCK },
  { labelKey: 'listing.availability.low', value: AvailabilityStatus.LOW },
  { labelKey: 'listing.availability.onOrder', value: AvailabilityStatus.ON_ORDER },
] as const;

export const ListingStockRow = ({
  bind,
  index,
  isLast,
  isNotShipped,
  onStatusChange,
  quantityMask,
  title,
  unitName,
  warehouseId,
}: ListingStockRowProps): ReactElement => {
  const { listingT } = useCatalogTexts();
  const t = useEditorTexts();

  const statusBinding = bind(getStockStatusPath(index));
  const quantityBinding = bind(getStockQuantityPath(index), { mask: quantityMask });

  const isQuantityReadOnly = quantityBinding.isReadOnly || isNotShipped;

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> ListingStockRow -> handleStatusChange:', { index, status: event.currentTarget.value });
    statusBinding.onChange(event);
    onStatusChange(index, event.currentTarget.value);
  };

  return (
    <li className="flex flex-col gap-3" data-testid={`listing-warehouse-${warehouseId}`}>
      <p className="text-base leading-6 font-medium text-on-panel" translate="no">{title}</p>
      <div className="grid grid-cols-[1.2fr_1fr] gap-3">
        <div data-testid={`listing-warehouse-${warehouseId}-status`}>
          <SelectField {...statusBinding} label={t('catalogEditor.availability.status')} onChange={handleStatusChange}>
            <option value={NOT_SHIPPED_STATUS_VALUE}>{t('catalogEditor.availability.none')}</option>
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={String(option.value)}>{listingT(option.labelKey)}</option>
            ))}
          </SelectField>
        </div>
        <div data-testid={`listing-warehouse-${warehouseId}-quantity`}>
          <TextField
            {...quantityBinding}
            autoComplete="off"
            enterKeyHint={isLast ? 'done' : 'next'}
            isReadOnly={isQuantityReadOnly}
            label={t('catalogEditor.availability.quantity', { unit: unitName })}
          />
        </div>
      </div>
    </li>
  );
};
