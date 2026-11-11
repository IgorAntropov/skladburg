import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AppAddressValue } from '@/shared/routing';

import {
  getBaseUnitLabelKey,
  useShowcaseListingQuery,
} from '@/entities/listing';
import { useCommandAccess } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import { createQuantityMask } from '@/shared/lib/mask';
import {
  useNavigate,
  useNavigationGuard,
} from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  DateField,
  ErrorNotice,
  LeaveConfirm,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { OrderTranslate } from '../../i18n/order/orderSection';
import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { useCreateDealDraftForm } from '../../api/order/useCreateDealDraftForm';
import { useOwnWarehouseOptions } from '../../api/useOwnWarehouseOptions';
import { formatDestinationLabel } from '../../lib/formatDestinationLabel';
import { formatListingQuantity } from '../../lib/formatListingQuantity';
import { resolveQuantityUnitName } from '../../lib/resolveQuantityUnitName';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import {
  EDITOR_FIELDS_CLASS_NAME,
  EDITOR_FORM_ACTIONS_CLASS_NAME,
  EDITOR_NOTE_CLASS_NAME,
  EDITOR_SAVE_BUTTON_CLASS_NAME,
} from '../editor-shared/editorStyles';
import {
  getOrderCityOptions,
  getOrderDefaults,
} from './orderCityOptions';

interface OrderFormProps {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue;
  listing: ShowcaseListing;
  onClose: () => void;
  supplierOrganizationId: string;
  t: OrderTranslate;
}

export const OrderForm = ({
  cityNames,
  destination,
  listing,
  onClose,
  supplierOrganizationId,
  t,
}: OrderFormProps): ReactElement => {
  const { locale } = useI18n();
  const { listingT, t: catalogT } = useCatalogTexts();
  const navigate = useNavigate();
  const warehouseState = useOwnWarehouseOptions();
  const titleId = useId();

  const [defaultValues] = useState(() => getOrderDefaults(listing, cityNames, destination.id));
  const focusRef = useRef<HTMLSelectElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const createdDealIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(false);
  const hasAutomaticDateRef = useRef(defaultValues.desiredDate !== '');

  const handleCreated = (deal: Deal): void => {
    console.log('> OrderForm -> handleCreated:', { isMounted: isMountedRef.current });

    if (isMountedRef.current) {
      createdDealIdRef.current = deal.id;
      navigate({ kind: 'object', object: { id: deal.id, type: 'deal' } }, { isFocusRequested: true });
    }
  };

  const form = useCreateDealDraftForm({ defaultValues, listingId: listing.id, onCreated: handleCreated, supplierOrganizationId, t });
  const access = useCommandAccess(form.command.method);

  const shouldGuard = (next: AppAddressValue | undefined): boolean => (
    createdDealIdRef.current === undefined
    || next?.kind !== 'object'
    || next.object.type !== 'deal'
    || next.object.id !== createdDealIdRef.current
  );
  const {
    cancelLeave,
    confirmLeave,
    isLeavePending,
    requestLeave,
  } = useNavigationGuard(form.isDirty, shouldGuard);

  const warehouseId = form.watchField('shipToWarehouseId');
  const isShowcaseDestination = warehouseId === destination.id;
  const quoteQuery = useShowcaseListingQuery(isShowcaseDestination ? undefined : listing.id, warehouseId);
  const quoteListing = isShowcaseDestination ? listing : quoteQuery.data;
  const cityOptions = quoteListing === undefined ? [] : getOrderCityOptions(quoteListing, cityNames);
  const isRouteLoading = !isShowcaseDestination && quoteQuery.isPending;
  const routeError = isShowcaseDestination ? null : quoteQuery.error;
  const isRouteEmpty = !isRouteLoading && routeError === null && cityOptions.length === 0;

  const quantityScale = listing.priceUnit?.baseQuantity ?? 1n;
  const quantityMask = useMemo(() => createQuantityMask(quantityScale), [quantityScale]);
  const baseUnitKey = getBaseUnitLabelKey(listing.baseUnit);
  const baseUnitName = baseUnitKey === undefined ? '' : listingT(baseUnitKey);
  const quantityUnit = resolveQuantityUnitName(listing.priceUnit, baseUnitName);
  const minimum = formatListingQuantity(locale, listing, listing.minOrderQuantity, listingT);
  const step = formatListingQuantity(locale, listing, listing.orderStep, listingT);
  const quantityHint = minimum === undefined || step === undefined ? undefined : t('order.quantityHint', { minimum, step });

  const { isPending } = form.command;
  const isReadOnly = access.status !== 'allowed' || isPending;
  const isCreateDisabled = cityOptions.length === 0;
  const warehouseField = form.getFieldProps('shipToWarehouseId');
  const cityField = form.getFieldProps('shipFromCityId');
  const dateField = form.getFieldProps('desiredDate');

  const clearAutomaticDate = (): void => {
    if (hasAutomaticDateRef.current) {
      hasAutomaticDateRef.current = false;
      form.setFieldValue('desiredDate', '');
    }
  };

  const handleWarehouseChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> OrderForm -> handleWarehouseChange:', {});
    warehouseField.onChange(event);
    form.setFieldValue('shipFromCityId', '');
    clearAutomaticDate();
  };

  const handleCityChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> OrderForm -> handleCityChange:', {});
    cityField.onChange(event);
    clearAutomaticDate();
  };

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
    console.log('> OrderForm -> handleDateChange:', {});
    hasAutomaticDateRef.current = false;
    dateField.onChange(event);
  };

  const handleWarehouseRef = (field: HTMLSelectElement | null): void => {
    focusRef.current = field;
    warehouseField.ref(field);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    console.log('> OrderForm -> handleSubmit:', { isCreateDisabled, isReadOnly });

    if (isReadOnly || isCreateDisabled) {
      event.preventDefault();

      return;
    }

    form.handleSubmit(event);
  };

  const handleCancel = (): void => {
    console.log('> OrderForm -> handleCancel:', {});
    requestLeave(onClose);
  };

  const handleStay = (): void => {
    console.log('> OrderForm -> handleStay:', {});
    cancelLeave();
    cancelRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    console.log('> OrderForm -> handleKeyDown:', { isPending });
    event.preventDefault();
    event.stopPropagation();

    if (isLeavePending) {
      handleStay();
    }
    else if (!isPending) {
      handleCancel();
    }
  };

  const handleRetryRoute = (): void => {
    console.log('> OrderForm -> handleRetryRoute:', {});
    void quoteQuery.refetch();
  };

  useEffect(() => {
    isMountedRef.current = true;
    focusRef.current?.focus();

    return (): void => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <form
      aria-labelledby={titleId}
      autoComplete="off"
      className="flex min-w-0 flex-col gap-4 border-t border-line pt-4"
      data-testid="order-form"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    >
      <h3 className="text-base leading-6 font-semibold text-on-panel" id={titleId}>{t('order.title')}</h3>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="order-leave-confirm"
          leaveLabel={t('order.leave.confirm')}
          message={t('order.leave.message')}
          onLeave={confirmLeave}
          onStay={handleStay}
          stayLabel={t('order.leave.stay')}
        />
      )}
      <div className={EDITOR_FIELDS_CLASS_NAME}>
        <div data-testid="order-warehouse">
          <SelectField
            {...warehouseField}
            isOptional={false}
            isReadOnly={isReadOnly}
            label={t('order.warehouse')}
            onChange={handleWarehouseChange}
            ref={handleWarehouseRef}
          >
            {warehouseState.options.map(option => (
              <option key={option.id} value={option.id}>{formatDestinationLabel(catalogT, option)}</option>
            ))}
          </SelectField>
        </div>
        <div data-testid="order-city">
          <SelectField
            {...cityField}
            isOptional={false}
            isReadOnly={isReadOnly || isCreateDisabled}
            label={t('order.city')}
            onChange={handleCityChange}
          >
            <option value="" />
            {cityOptions.map(({ name, quote }) => <option key={quote.shipFromCityId} value={quote.shipFromCityId}>{name}</option>)}
          </SelectField>
        </div>
        {isRouteLoading && <p className={EDITOR_NOTE_CLASS_NAME} role="status">{t('order.route.loading')}</p>}
        {isRouteEmpty && <p className={EDITOR_NOTE_CLASS_NAME}>{t('order.route.empty')}</p>}
        {routeError !== null && <ErrorNotice error={routeError} isRetrying={quoteQuery.isFetching} onRetry={handleRetryRoute} />}
        <div data-testid="order-quantity">
          <TextField
            {...form.getFieldProps('quantity', { mask: quantityMask })}
            autoComplete="off"
            enterKeyHint="next"
            hint={quantityHint}
            isOptional={false}
            isReadOnly={isReadOnly}
            label={t('order.quantity', { unit: quantityUnit })}
          />
        </div>
        <div data-testid="order-date">
          <DateField
            {...dateField}
            hint={t('order.dateHint')}
            isReadOnly={isReadOnly}
            label={t('order.date')}
            onChange={handleDateChange}
          />
        </div>
      </div>
      <div className={EDITOR_FORM_ACTIONS_CLASS_NAME}>
        <div className="flex flex-wrap items-start gap-3">
          <ActionButton
            access={access}
            className={EDITOR_SAVE_BUTTON_CLASS_NAME}
            command={form.command}
            data-testid="order-create"
            errorPlacement="external"
            isDisabled={isCreateDisabled}
            type="submit"
            variant="primary"
          >
            {t('order.create')}
          </ActionButton>
          <Button aria-disabled={isPending} onClick={handleCancel} ref={cancelRef} variant="secondary">
            {t('order.cancel')}
          </Button>
        </div>
        <CommandErrorNotice command={form.command} />
      </div>
    </form>
  );
};
