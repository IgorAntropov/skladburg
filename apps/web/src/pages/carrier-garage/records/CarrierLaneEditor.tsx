import type { CarrierLane } from '@skladburg/contracts/fleet/v1/fleet';
import type { City } from '@skladburg/contracts/network/v1/network';
import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { useCatalogSection } from '@/shared/i18n';
import {
  SelectField,
  SwitchField,
  TextField,
} from '@/shared/ui';

import { useSaveCarrierLaneForm } from '../api/commands/useSaveCarrierLaneForm';
import { GarageFormFrame } from '../ui/GarageFormFrame';
import { recordsSection } from './i18n/recordsSection';
import {
  DEPARTURE_WEEKDAYS_FIELD,
  WEEKDAYS,
} from './laneFormValues';
import { RecordEditorFallback } from './RecordEditorFallback';

interface CarrierLaneEditorProps {
  cities: readonly City[];
  lane: CarrierLane | undefined;
  onClose: () => void;
  onSaved: (saved: CarrierLane) => void;
}

export const CarrierLaneEditor = ({ cities, lane, onClose, onSaved }: CarrierLaneEditorProps): ReactElement => {
  const { retry, status, t } = useCatalogSection(recordsSection);
  const form = useSaveCarrierLaneForm(lane, onSaved, t);

  if (t === undefined) {
    return <RecordEditorFallback isError={status === 'error'} onClose={onClose} onRetry={retry} />;
  }

  const cityOptions = cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>);

  return (
    <GarageFormFrame
      command={form.command}
      isDirty={form.isDirty}
      onClose={onClose}
      onSubmit={form.handleSubmit}
      testId="garage-lane-form"
      title={t(lane === undefined ? 'garageRecords.lane.create' : 'garageRecords.lane.edit')}
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div data-testid="garage-lane-from">
          <SelectField {...form.getFieldProps('fromCityId')} label={t('garageRecords.lane.fromCity')}>
            <option value="">{t('garageRecords.lane.cityPlaceholder')}</option>
            {cityOptions}
          </SelectField>
        </div>
        <div data-testid="garage-lane-to">
          <SelectField {...form.getFieldProps('toCityId')} label={t('garageRecords.lane.toCity')}>
            <option value="">{t('garageRecords.lane.cityPlaceholder')}</option>
            {cityOptions}
          </SelectField>
        </div>
      </div>
      <div data-testid="garage-lane-tariff">
        <TextField {...form.getFieldProps('tariff')} inputMode="decimal" label={t('garageRecords.lane.tariff')} />
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-on-panel">{t('garageRecords.lane.weekdays')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEEKDAYS.map(({ field }) => {
            const path = `weekdays.${field}` as const;
            const binding = form.getFieldProps(path);
            const handleWeekdayChange = (event: ChangeEvent<HTMLInputElement>): void => {
              binding.onChange(event);

              if (event.currentTarget.checked && path !== DEPARTURE_WEEKDAYS_FIELD) {
                form.setFieldValue(DEPARTURE_WEEKDAYS_FIELD, form.watchField(DEPARTURE_WEEKDAYS_FIELD));
              }
            };

            return (
              <SwitchField
                {...binding}
                data-testid={`garage-lane-${field}`}
                key={field}
                label={t(`garageRecords.weekday.${field}`)}
                onChange={handleWeekdayChange}
              />
            );
          })}
        </div>
      </fieldset>
      <SwitchField {...form.getFieldProps('isActive')} label={t('garageRecords.lane.active')} />
    </GarageFormFrame>
  );
};
