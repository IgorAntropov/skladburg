import type { City } from '@skladburg/contracts/network/v1/network';
import type { ReactElement } from 'react';

import { useRef } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  Button,
  DateField,
  SelectField,
  TextField,
} from '@/shared/ui';

import type { VehicleFormInputValue } from './vehicleFormValues';
import type { VehicleTranslate } from './vehicleSection';

import { VEHICLE_AVAILABILITY_CAPACITY } from './vehicleAvailability';

type AvailabilityRowPathValue = `details.availability.${number}`;

interface VehicleAvailabilityFieldsProps {
  cities: readonly City[];
  form: CommandFormValue<VehicleFormInputValue>;
  t: VehicleTranslate;
}

const SLOTS = Array.from({ length: VEHICLE_AVAILABILITY_CAPACITY }, (_value, index) => index);

const toRowPath = (slot: number): AvailabilityRowPathValue => `details.availability.${String(slot)}` as AvailabilityRowPathValue;

export const VehicleAvailabilityFields = ({ cities, form, t }: VehicleAvailabilityFieldsProps): ReactElement => {
  const pendingFocus = useRef<number | undefined>(undefined);
  const addRef = useRef<HTMLButtonElement>(null);

  const windowOrder = form.watchField('windowOrder');
  const isAtCapacity = windowOrder.length >= VEHICLE_AVAILABILITY_CAPACITY;

  const handleAdd = (): void => {
    const slot = SLOTS.find(index => !windowOrder.includes(index));

    if (slot === undefined) {
      return;
    }

    pendingFocus.current = slot;
    form.setFieldValue('windowOrder', [...windowOrder, slot]);
  };

  const handleRemove = (slot: number): void => {
    const path = toRowPath(slot);

    form.setFieldValue(`${path}.cityId`, '');
    form.setFieldValue(`${path}.endDate`, '');
    form.setFieldValue(`${path}.endTime`, '');
    form.setFieldValue(`${path}.sourceIndex`, -1);
    form.setFieldValue(`${path}.startDate`, '');
    form.setFieldValue(`${path}.startTime`, '');
    form.setFieldValue('windowOrder', windowOrder.filter(index => index !== slot));
    addRef.current?.focus();
  };

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-base font-semibold text-on-panel">{t('garageVehicle.availability.title')}</legend>
      <p className="text-sm text-on-panel-muted">{t('garageVehicle.availability.description')}</p>
      {windowOrder.map((slot, index) => {
        const path = toRowPath(slot);
        const city = form.getFieldProps(`${path}.cityId`);
        const number = index + 1;

        const handleCityRef = (element: HTMLSelectElement | null): void => {
          city.ref(element);

          if (element !== null && pendingFocus.current === slot) {
            pendingFocus.current = undefined;
            element.focus();
          }
        };

        const handleRemoveClick = (): void => {
          handleRemove(slot);
        };

        return (
          <fieldset className="min-w-0 space-y-3 border-b border-line pb-3" data-testid="garage-vehicle-window" key={slot}>
            <legend className="text-sm font-semibold text-on-panel">{t('garageVehicle.availability.row', { number })}</legend>
            <div data-testid="garage-vehicle-window-city">
              <SelectField {...city} isOptional={false} label={t('garageVehicle.availability.city')} ref={handleCityRef}>
                <option value="" />
                {cities.map(cityOption => <option key={cityOption.id} value={cityOption.id}>{cityOption.name}</option>)}
              </SelectField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateField
                {...form.getFieldProps(`${path}.startDate`)}
                isOptional={false}
                label={t('garageVehicle.availability.startDate')}
                max="9999-12-31"
                min="0001-01-01"
              />
              <TextField
                {...form.getFieldProps(`${path}.startTime`)}
                isOptional={false}
                label={t('garageVehicle.availability.startTime')}
                placeholder={t('garageVehicle.availability.timeExample')}
                spellCheck={false}
              />
              <DateField
                {...form.getFieldProps(`${path}.endDate`)}
                isOptional={false}
                label={t('garageVehicle.availability.endDate')}
                max="9999-12-31"
                min="0001-01-01"
              />
              <TextField
                {...form.getFieldProps(`${path}.endTime`)}
                isOptional={false}
                label={t('garageVehicle.availability.endTime')}
                placeholder={t('garageVehicle.availability.timeExample')}
                spellCheck={false}
              />
            </div>
            <Button data-testid="garage-vehicle-remove-window" onClick={handleRemoveClick} variant="secondary">
              {t('garageVehicle.availability.remove', { number })}
            </Button>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-disabled={isAtCapacity}
          data-testid="garage-vehicle-add-window"
          onClick={handleAdd}
          ref={addRef}
          variant="secondary"
        >
          {t('garageVehicle.availability.add')}
        </Button>
        {isAtCapacity && (
          <p className="text-sm text-on-panel-muted">
            {t('garageVehicle.availability.maximum', { count: VEHICLE_AVAILABILITY_CAPACITY })}
          </p>
        )}
      </div>
    </fieldset>
  );
};
