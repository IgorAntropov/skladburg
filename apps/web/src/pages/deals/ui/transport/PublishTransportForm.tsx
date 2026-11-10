import type { ReactElement } from 'react';

import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';

import { useCommandAccess } from '@/entities/session';
import { useCatalogSection } from '@/shared/i18n';
import {
  Button,
  DateField,
  ErrorNotice,
  SelectField,
  Skeleton,
  SkeletonGroup,
  SwitchField,
  TextField,
} from '@/shared/ui';

import type { DealEditorProps } from '../inspector/dealInspectorTypes';
import type { DealTransportTranslate } from './dealTransportSection';

import { usePublishTransportForm } from '../../api/commands/usePublishTransportForm';
import { TRANSPORT_BODY_TYPES } from '../../lib/publishTransportFormValues';
import { DealEditorForm } from '../inspector/DealEditorForm';
import { dealTransportSection } from './dealTransportSection';

const CARGO_OPTIONS = [
  ['dealTransport.cargo.general', VehicleCargoKind.GENERAL],
  ['dealTransport.cargo.temperature', VehicleCargoKind.TEMPERATURE_CONTROLLED],
  ['dealTransport.cargo.oversize', VehicleCargoKind.OVERSIZE],
] as const;

const MEASURES = [
  ['weightGrams', 'weight'],
  ['volumeCubicCentimeters', 'volume'],
  ['lengthMillimeters', 'length'],
  ['widthMillimeters', 'width'],
  ['heightMillimeters', 'height'],
  ['palletPlaces', 'pallet-places'],
] as const;

const FIELD_GRID_CLASS_NAME = 'grid grid-cols-1 gap-3 @xs:grid-cols-2';

interface WindowFieldsProps {
  form: ReturnType<typeof usePublishTransportForm>;
  kind: 'delivery' | 'pickup';
  t: DealTransportTranslate;
}

const WindowFields = ({ form, kind, t }: WindowFieldsProps): ReactElement => {
  const path = `${kind}Window` as const;

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-base font-semibold">{t(`dealTransport.${path}`)}</legend>
      <div className={FIELD_GRID_CLASS_NAME}>
        <div data-testid={`deal-transport-${kind}-start-date`}>
          <DateField
            {...form.getFieldProps(`${path}.startDate`)}
            isOptional={false}
            label={t('dealTransport.startDate')}
            max="9999-12-31"
            min="0001-01-01"
          />
        </div>
        <div data-testid={`deal-transport-${kind}-start-time`}>
          <TextField
            {...form.getFieldProps(`${path}.startTime`)}
            isOptional={false}
            label={t('dealTransport.startTime')}
            placeholder={t('dealTransport.timeExample')}
            spellCheck={false}
          />
        </div>
        <div data-testid={`deal-transport-${kind}-end-date`}>
          <DateField
            {...form.getFieldProps(`${path}.endDate`)}
            isOptional={false}
            label={t('dealTransport.endDate')}
            max="9999-12-31"
            min="0001-01-01"
          />
        </div>
        <div data-testid={`deal-transport-${kind}-end-time`}>
          <TextField
            {...form.getFieldProps(`${path}.endTime`)}
            isOptional={false}
            label={t('dealTransport.endTime')}
            placeholder={t('dealTransport.timeExample')}
            spellCheck={false}
          />
        </div>
      </div>
    </fieldset>
  );
};

interface PublishTransportFieldsProps extends DealEditorProps {
  transportT: DealTransportTranslate;
}

const PublishTransportFields = ({ deal, isCurrentAction, onClose, onPublished, onRefresh, t, transportT }: PublishTransportFieldsProps):
ReactElement => {
  const access = useCommandAccess(LogisticsService.method.publishTransportRequest, { kind: 'organization' });
  const form = usePublishTransportForm({ deal, onPublished, t: transportT });
  const isColdCargo = form.watchField('cargo.cargoKind') === String(VehicleCargoKind.TEMPERATURE_CONTROLLED);

  return (
    <DealEditorForm
      access={access}
      command={form.command}
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      label={transportT('dealTransport.publishSubmit')}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitTestId="deal-transport-publish-submit"
      t={t}
      version={deal.version}
    >
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-base font-semibold">{transportT('dealTransport.cargo')}</legend>
        <div data-testid="deal-transport-cargo-kind">
          <SelectField {...form.getFieldProps('cargo.cargoKind')} label={transportT('dealTransport.cargoKind')}>
            <option value="" />
            {CARGO_OPTIONS.map(([key, value]) => <option key={value} value={value}>{transportT(key)}</option>)}
          </SelectField>
        </div>
        <div className={FIELD_GRID_CLASS_NAME}>
          {MEASURES.map(([field, testId]) => (
            <div data-testid={`deal-transport-${testId}`} key={field}>
              <TextField
                {...form.getFieldProps(`cargo.${field}`)}
                inputMode="numeric"
                isOptional={field === 'palletPlaces'}
                label={transportT(`dealTransport.${field === 'palletPlaces' ? field : testId}`)}
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-base font-semibold">{transportT('dealTransport.bodyTypes')}</legend>
        <div className="grid gap-2">
          {TRANSPORT_BODY_TYPES.map(([field, type]) => {
            const { error, isReadOnly, name, onBlur, onChange, ref } = form.getFieldProps(`bodyTypes.${field}`);

            return (
              <SwitchField
                data-testid={`deal-transport-body-type-${String(type)}`}
                error={error}
                isReadOnly={isReadOnly}
                key={type}
                label={transportT(`dealTransport.body.${field}`)}
                name={name}
                onBlur={onBlur}
                onChange={onChange}
                ref={ref}
              />
            );
          })}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-base font-semibold">{transportT('dealTransport.temperature')}</legend>
        <div className={FIELD_GRID_CLASS_NAME}>
          <div data-testid="deal-transport-temperature-min">
            <TextField
              {...form.getFieldProps('cargo.temperature.minCelsius')}
              isOptional={!isColdCargo}
              label={transportT('dealTransport.temperatureMin')}
              spellCheck={false}
            />
          </div>
          <div data-testid="deal-transport-temperature-max">
            <TextField
              {...form.getFieldProps('cargo.temperature.maxCelsius')}
              isOptional={!isColdCargo}
              label={transportT('dealTransport.temperatureMax')}
              spellCheck={false}
            />
          </div>
        </div>
      </fieldset>
      <WindowFields form={form} kind="pickup" t={transportT} />
      <WindowFields form={form} kind="delivery" t={transportT} />
    </DealEditorForm>
  );
};

export const PublishTransportForm = (props: DealEditorProps): ReactElement => {
  const { retry, status, t } = useCatalogSection(dealTransportSection);

  if (t !== undefined) {
    return <PublishTransportFields {...props} transportT={t} />;
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2">
        <ErrorNotice error={null} onRetry={retry} />
        <Button onClick={props.onClose} variant="secondary">{props.t('dealInspector.back')}</Button>
      </div>
    );
  }

  return <SkeletonGroup isFilled label={props.t('dealInspector.loading')}><Skeleton shape="block" /></SkeletonGroup>;
};
