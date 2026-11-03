import type {
  Listing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { Lock } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
  FormFieldPathValue,
} from '@/shared/lib/form';

import { getBaseUnitLabelKey } from '@/entities/listing';
import { useCommandAccess } from '@/entities/session';
import {
  createQuantityMask,
  createWholeNumberMask,
} from '@/shared/lib/mask';
import {
  ActionButton,
  TextField,
  TextLink,
} from '@/shared/ui';

import type { DestinationOptionValue } from '../../lib/destinationOptions';
import type { ListingFormValues } from '../../lib/listingFormValues';

import { useSaveListingForm } from '../../api/editor/useSaveListingForm';
import {
  getStockQuantityPath,
  getStockStatusPath,
} from '../../lib/fieldPaths';
import { formatDestinationLabel } from '../../lib/formatDestinationLabel';
import { getUnitBaseLabelKey } from '../../lib/getUnitBaseLabelKey';
import { NOT_SHIPPED_STATUS_VALUE } from '../../lib/listingFormValues';
import { resolveQuantityUnitName } from '../../lib/resolveQuantityUnitName';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useEditorTexts } from '../../model/useEditorTexts';
import { EditorReloadButton } from '../editor-shared/EditorReloadButton';
import {
  EDITOR_FORM_ACTIONS_CLASS_NAME,
  EDITOR_GROUP_CLASS_NAME,
  EDITOR_GROUP_HEADING_CLASS_NAME,
  EDITOR_NOTE_CLASS_NAME,
  EDITOR_WIDE_BUTTON_CLASS_NAME,
} from '../editor-shared/editorStyles';
import { RuleErrorNotice } from '../editor-shared/RuleErrorNotice';
import { SavedStatus } from '../editor-shared/SavedStatus';
import { ListingStockRow } from './ListingStockRow';

interface ListingPositionFormProps {
  isReloading: boolean;
  isUnitLocked: boolean;
  listing: Listing;
  onDirtyChange: (isDirty: boolean) => void;
  onReload: () => void;
  onSaved: (saved: Listing) => void;
  product: Product;
  warehouses: readonly DestinationOptionValue[];
}

const WHOLE_NUMBER_MASK = createWholeNumberMask();

export const ListingPositionForm = ({
  isReloading,
  isUnitLocked,
  listing,
  onDirtyChange,
  onReload,
  onSaved,
  product,
  warehouses: initialWarehouses,
}: ListingPositionFormProps): ReactElement => {
  const { listingT, t } = useCatalogTexts();
  const editorT = useEditorTexts();
  const positionTitleId = useId();
  const availabilityTitleId = useId();
  const [warehouses] = useState(initialWarehouses);
  const [hasSaved, setHasSaved] = useState(false);

  const warehouseIds = useMemo(() => warehouses.map(warehouse => warehouse.id), [warehouses]);
  const baseQuantity = listing.priceUnit?.baseQuantity ?? 1n;
  const quantityMask = useMemo(() => createQuantityMask(baseQuantity), [baseQuantity]);

  const handleSaved = (saved: Listing): void => {
    console.log('> ListingPositionForm -> handleSaved:', { version: String(saved.version) });
    setHasSaved(true);
    onSaved(saved);
  };

  const form = useSaveListingForm({ isUnitLocked, listing, onSaved: handleSaved, t: editorT, warehouseIds });
  const access = useCommandAccess(form.command.method);

  const baseUnitLabelKey = getBaseUnitLabelKey(product.baseUnit);
  const baseUnitLabel = baseUnitLabelKey === undefined ? '' : listingT(baseUnitLabelKey);
  const unitName = resolveQuantityUnitName(listing.priceUnit, baseUnitLabel);
  const isAccessDenied = access.status !== 'allowed';
  const isVersionConflict = form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isSavedStatusShown = hasSaved && !form.isDirty;
  const hasWarehouses = warehouses.length > 0;

  const bind = (name: FormFieldPathValue<ListingFormValues>, options?: FormFieldOptionsValue): FormFieldBindingValue => {
    const binding = { ...form.getFieldProps(name, options), isOptional: false };

    return isAccessDenied ? { ...binding, isReadOnly: true } : binding;
  };

  const unitBinding = bind('priceUnit.name');
  const unitBaseBinding = bind('priceUnit.baseQuantity', { mask: WHOLE_NUMBER_MASK });
  const isUnitNameReadOnly = isUnitLocked || unitBinding.isReadOnly;
  const isUnitBaseReadOnly = isUnitLocked || unitBaseBinding.isReadOnly;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> ListingPositionForm -> handleSubmit:', { isAccessDenied });

    if (isAccessDenied) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  const handleStatusChange = (index: number, status: string): void => {
    if (status === NOT_SHIPPED_STATUS_VALUE) {
      form.setFieldValue(getStockQuantityPath(index), '');
    }
  };

  useEffect(() => {
    onDirtyChange(form.isDirty);

    return (): void => {
      onDirtyChange(false);
    };
  }, [form.isDirty, onDirtyChange]);

  return (
    <form className="flex flex-col gap-4" data-testid="listing-position-form" noValidate onSubmit={handleSubmit}>
      <section aria-labelledby={positionTitleId} className={EDITOR_GROUP_CLASS_NAME}>
        <h4 className={EDITOR_GROUP_HEADING_CLASS_NAME} id={positionTitleId}>{editorT('catalogEditor.position.title')}</h4>
        <div data-testid="listing-unit-name">
          <TextField
            {...unitBinding}
            autoComplete="off"
            enterKeyHint="next"
            isReadOnly={isUnitNameReadOnly}
            label={editorT('catalogEditor.unit.name')}
          />
        </div>
        <div data-testid="listing-unit-base">
          <TextField
            {...unitBaseBinding}
            autoComplete="off"
            enterKeyHint="next"
            isReadOnly={isUnitBaseReadOnly}
            label={editorT(getUnitBaseLabelKey(product.baseUnit))}
          />
        </div>
        {isUnitLocked && (
          <p className="flex items-start gap-1 text-sm leading-5 text-on-panel-muted" data-testid="listing-unit-locked-reason">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            {editorT('catalogEditor.unit.locked')}
          </p>
        )}
        <div data-testid="listing-min-order">
          <TextField
            {...bind('minOrderQuantity', { mask: quantityMask })}
            autoComplete="off"
            enterKeyHint="next"
            label={editorT('catalogEditor.minOrder', { unit: unitName })}
          />
        </div>
        <div data-testid="listing-order-step">
          <TextField
            {...bind('orderStep', { mask: quantityMask })}
            autoComplete="off"
            enterKeyHint={hasWarehouses ? 'next' : 'done'}
            hint={editorT('catalogEditor.orderStepHint')}
            label={editorT('catalogEditor.orderStep', { unit: unitName })}
          />
        </div>
      </section>
      <section aria-labelledby={availabilityTitleId} className={EDITOR_GROUP_CLASS_NAME}>
        <h4 className={EDITOR_GROUP_HEADING_CLASS_NAME} id={availabilityTitleId}>
          {editorT('catalogEditor.availability.title')}
        </h4>
        {hasWarehouses
          ? (
              <>
                <p className={EDITOR_NOTE_CLASS_NAME}>{editorT('catalogEditor.availability.hint')}</p>
                <ul className="flex flex-col gap-4">
                  {warehouses.map((warehouse, index) => (
                    <ListingStockRow
                      bind={bind}
                      index={index}
                      isLast={index === warehouses.length - 1}
                      isNotShipped={form.watchField(getStockStatusPath(index)) === NOT_SHIPPED_STATUS_VALUE}
                      key={warehouse.id}
                      onStatusChange={handleStatusChange}
                      quantityMask={quantityMask}
                      title={formatDestinationLabel(t, warehouse)}
                      unitName={unitName}
                      warehouseId={warehouse.id}
                    />
                  ))}
                </ul>
              </>
            )
          : (
              <>
                <p className={EDITOR_NOTE_CLASS_NAME}>{editorT('catalogEditor.availability.noWarehouses')}</p>
                <TextLink size="sm" to={{ kind: 'section', section: 'warehouse' }}>
                  {t('catalog.empty.noWarehouse.action')}
                </TextLink>
              </>
            )}
      </section>
      <div className={EDITOR_FORM_ACTIONS_CLASS_NAME}>
        <ActionButton
          access={access}
          className={EDITOR_WIDE_BUTTON_CLASS_NAME}
          command={form.command}
          data-testid="listing-save"
          errorPlacement="external"
          type="submit"
          variant="primary"
        >
          {editorT('catalogEditor.save')}
        </ActionButton>
        {isSavedStatusShown && <SavedStatus />}
        <RuleErrorNotice command={form.command} />
        {isVersionConflict && <EditorReloadButton isReloading={isReloading} onReload={onReload} testId="listing-reload" />}
      </div>
    </form>
  );
};
