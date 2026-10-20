import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type {
  KeyboardEvent,
  ReactElement,
} from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { WarehousePlacesValue } from '../../model/warehousePlacesTypes';

import { useCreateWarehouseForm } from '../../api/form/useCreateWarehouseForm';

const FIRST_FIELD_NAME = 'name';

const SUBMIT_CLASS_NAME = 'min-w-44';

const ACTIONS_CLASS_NAME = 'mt-2 flex flex-wrap items-start gap-3';

export interface CreateWarehouseFormBodyProps {
  onCancel: () => void;
  onCreated: (warehouse: Warehouse) => void;
  places: WarehousePlacesValue;
}

export const CreateWarehouseFormBody = ({ onCancel, onCreated, places }: CreateWarehouseFormBodyProps): ReactElement => {
  const { t } = useI18n();
  const form = useCreateWarehouseForm({ onCreated, places });
  const access = useCommandAccess(form.command.method);
  const formRef = useRef<HTMLFormElement>(null);

  const isCancelBlocked = form.command.isPending;

  const handleCancelClick = (): void => {
    console.log('> CreateWarehouseFormBody -> handleCancelClick:', { isCancelBlocked });
    onCancel();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || isCancelBlocked) {
      return;
    }

    console.log('> CreateWarehouseFormBody -> handleKeyDown:', { key: event.key });
    onCancel();
  };

  useEffect(() => {
    const field = formRef.current?.elements.namedItem(FIRST_FIELD_NAME);

    if (field instanceof HTMLInputElement) {
      field.focus();
    }
  }, []);

  return (
    <form
      className="flex w-full max-w-md flex-col gap-4"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={form.handleSubmit}
      ref={formRef}
    >
      <TextField autoComplete="off" label={t('warehouse.create.name')} {...form.getFieldProps('name')} />
      <SelectField hint={t('warehouse.create.city_hint')} label={t('warehouse.create.city')} {...form.getFieldProps('cityId')}>
        <option value="" />
        {places.cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
      </SelectField>
      <TextField autoComplete="street-address" label={t('warehouse.create.address')} {...form.getFieldProps('address')} />
      <div className={ACTIONS_CLASS_NAME}>
        <ActionButton
          access={access}
          className={SUBMIT_CLASS_NAME}
          command={form.command}
          data-testid="create-warehouse-submit"
          errorPlacement="external"
          type="submit"
        >
          {t('warehouse.create.submit')}
        </ActionButton>
        <Button
          aria-disabled={isCancelBlocked}
          data-testid="create-warehouse-cancel"
          onClick={handleCancelClick}
          variant="secondary"
        >
          {t('warehouse.create.cancel')}
        </Button>
      </div>
      <CommandErrorNotice command={form.command} />
    </form>
  );
};
