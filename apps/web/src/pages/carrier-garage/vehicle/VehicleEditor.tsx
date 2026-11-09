import type { Vehicle } from '@skladburg/contracts/fleet/v1/fleet';
import type { City } from '@skladburg/contracts/network/v1/network';
import type { ReactElement } from 'react';

import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  SelectField,
  Skeleton,
  SkeletonGroup,
  SwitchField,
  TextField,
  useDelayedVisibility,
} from '@/shared/ui';

import type { GarageTranslate } from '../i18n/garageSection';
import type { VehicleTranslate } from './vehicleSection';

import { useSaveVehicleForm } from '../api/commands/useSaveVehicleForm';
import { garageSection } from '../i18n/garageSection';
import { GarageFormFrame } from '../ui/GarageFormFrame';
import { VehicleAvailabilityFields } from './VehicleAvailabilityFields';
import {
  VEHICLE_BODY_LABELS,
  VEHICLE_CARGO_LABELS,
} from './vehicleLabels';
import { vehicleSection } from './vehicleSection';

interface VehicleEditorFieldsProps extends VehicleEditorProps {
  garageT: GarageTranslate;
  t: VehicleTranslate;
}

interface VehicleEditorProps {
  cities: readonly City[];
  onClose: () => void;
  onSaved: (saved: Vehicle) => void;
  vehicle: undefined | Vehicle;
}

const MEASURE_FIELDS = [
  'payloadGrams',
  'volumeCubicCentimeters',
  'lengthMillimeters',
  'widthMillimeters',
  'heightMillimeters',
  'palletPlaces',
] as const;

const CARGO_FIELDS = [
  { kind: VehicleCargoKind.GENERAL, name: 'hasGeneralCargo' },
  { kind: VehicleCargoKind.TEMPERATURE_CONTROLLED, name: 'hasTemperatureControlledCargo' },
  { kind: VehicleCargoKind.OVERSIZE, name: 'hasOversizeCargo' },
] as const;

const VehicleEditorFields = ({ cities, garageT, onClose, onSaved, t, vehicle }: VehicleEditorFieldsProps): ReactElement => {
  const form = useSaveVehicleForm({ onSaved, t, vehicle });
  const title = t(vehicle === undefined ? 'garageVehicle.title.create' : 'garageVehicle.title.edit');

  return (
    <GarageFormFrame
      command={form.command}
      isDirty={form.isDirty}
      onClose={onClose}
      onSubmit={form.handleSubmit}
      testId="garage-vehicle-form"
      title={title}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          {...form.getFieldProps('details.registrationNumber')}
          hint={t('garageVehicle.fields.registrationNumberExample')}
          isOptional={false}
          label={t('garageVehicle.fields.registrationNumber')}
          spellCheck={false}
        />
        <SelectField {...form.getFieldProps('details.bodyType')} isOptional={false} label={t('garageVehicle.fields.bodyType')}>
          <option value="" />
          {Object.entries(VEHICLE_BODY_LABELS).map(([value, label]) => <option key={value} value={value}>{garageT(label)}</option>)}
        </SelectField>
        {MEASURE_FIELDS.map(field => (
          <div data-testid={field === 'payloadGrams' ? 'garage-vehicle-payload' : undefined} key={field}>
            <TextField
              {...form.getFieldProps(`details.${field}`)}
              inputMode="numeric"
              isOptional={false}
              label={t(`garageVehicle.fields.${field}`)}
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-base font-semibold text-on-panel">{t('garageVehicle.cargo.title')}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CARGO_FIELDS.map(({ kind, name }) => {
            const label = VEHICLE_CARGO_LABELS[kind];

            if (label === undefined) {
              return null;
            }

            const { error, isReadOnly, name: fieldName, onBlur, onChange, ref } = form.getFieldProps(name);

            return (
              <SwitchField
                error={error}
                isReadOnly={isReadOnly}
                key={kind}
                label={garageT(label)}
                name={fieldName}
                onBlur={onBlur}
                onChange={onChange}
                ref={ref}
              />
            );
          })}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-base font-semibold text-on-panel">{t('garageVehicle.temperature.title')}</legend>
        <p className="text-sm text-on-panel-muted">{t('garageVehicle.temperature.description')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField {...form.getFieldProps('details.temperature.minCelsius')} isOptional label={t('garageVehicle.temperature.min')} />
          <TextField {...form.getFieldProps('details.temperature.maxCelsius')} isOptional label={t('garageVehicle.temperature.max')} />
        </div>
      </fieldset>
      <VehicleAvailabilityFields cities={cities} form={form} t={t} />
    </GarageFormFrame>
  );
};

export const VehicleEditor = (props: VehicleEditorProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(vehicleSection);
  const { t: garageT } = useCatalogSection(garageSection);
  const isFailed = status === 'error';
  const isSkeletonFilled = useDelayedVisibility(t === undefined && !isFailed);

  if (t !== undefined && garageT !== undefined) {
    return <VehicleEditorFields {...props} garageT={garageT} t={t} />;
  }

  if (isFailed) {
    return (
      <div className="flex max-w-prose flex-col items-start gap-3">
        <p className="text-base leading-6" role="alert">{mainT('routing.chunkError.message')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={retry} variant="secondary">{mainT('common.retry')}</Button>
          <Button onClick={props.onClose} variant="secondary">{mainT('hud.inspector.close')}</Button>
        </div>
      </div>
    );
  }

  return (
    <SkeletonGroup isFilled={isSkeletonFilled} label={mainT('routing.section.loading')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </SkeletonGroup>
  );
};
