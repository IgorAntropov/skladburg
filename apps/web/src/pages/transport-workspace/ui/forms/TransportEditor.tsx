import type { ReactElement } from 'react';

import { Truck } from 'lucide-react';

import {
  DateField,
  EmptyState,
  SelectField,
  TextField,
  useAnnounce,
} from '@/shared/ui';

import type { TransportEditorProps } from './transportEditorTypes';

import { useAssignmentFleet } from '../../api/useAssignmentFleet';
import {
  useAssignTripForm,
  useSubmitOfferForm,
} from '../../api/useTransportWorkspaceForms';
import { TransportData } from '../TransportData';
import { TransportFormFrame } from './TransportFormFrame';

type AssignmentEditorProps = Extract<TransportEditorProps, { kind: 'assignment' }>;
type OfferEditorProps = Extract<TransportEditorProps, { kind: 'offer' }>;

const OfferEditor = ({ isCurrentAction, onClose, onRefresh, onSaved, requestId, t }: OfferEditorProps): ReactElement => {
  const announce = useAnnounce();

  const handleSaved = (): void => {
    announce(t('transport.offers.submitted'));
    onSaved();
  };
  const form = useSubmitOfferForm(requestId, handleSaved, t);

  return (
    <TransportFormFrame
      command={form.command}
      formTestId="transport-offer-form"
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitLabel={t('transport.offers.submit')}
      submitTestId="transport-offer-submit"
      t={t}
      title={t('transport.offers.open')}
    >
      <div data-testid="transport-offer-amount">
        <TextField
          {...form.getFieldProps('amount')}
          inputMode="decimal"
          isOptional={false}
          label={t('transport.offers.amount')}
          spellCheck={false}
        />
      </div>
    </TransportFormFrame>
  );
};

const AssignmentEditor = ({ isCurrentAction, onClose, onRefresh, onSaved, t, trip }: AssignmentEditorProps): ReactElement => {
  const announce = useAnnounce();
  const fleet = useAssignmentFleet(true);
  const activeDrivers = fleet.data?.drivers.filter(driver => driver.isActive) ?? [];

  const handleSaved = (): void => {
    announce(t('transport.trips.assignedNotice'));
    onSaved();
  };
  const form = useAssignTripForm(trip, handleSaved, t);

  return (
    <TransportFormFrame
      command={form.command}
      formTestId="transport-trip-assign-form"
      isCurrentAction={isCurrentAction}
      isDirty={form.isDirty}
      isDisabled={!fleet.data?.vehicles.length || activeDrivers.length === 0 || fleet.isError}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={form.handleSubmit}
      submitLabel={t('transport.trips.assignSubmit')}
      submitTestId="transport-trip-assign-submit"
      t={t}
      title={t('transport.trips.assignment')}
      version={trip.version}
    >
      <TransportData query={fleet} t={t}>
        {({ vehicles }) => (
          <>
            {(activeDrivers.length === 0 || vehicles.length === 0) && (
              <EmptyState icon={Truck} text={t('transport.trips.fleetEmpty')} />
            )}
            <div data-testid="transport-trip-vehicle">
              <SelectField {...form.getFieldProps('vehicleId')} label={t('transport.trips.vehicle')}>
                <option value="" />
                {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.details?.registrationNumber}</option>)}
              </SelectField>
            </div>
            <div data-testid="transport-trip-driver">
              <SelectField {...form.getFieldProps('driverId')} label={t('transport.trips.driver')}>
                <option value="" />
                {activeDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.displayName}</option>)}
              </SelectField>
            </div>
          </>
        )}
      </TransportData>
      <div className="grid gap-3 @xs:grid-cols-2">
        <div data-testid="transport-trip-departure-date">
          <DateField {...form.getFieldProps('departureDate')} isOptional={false} label={t('transport.trips.departureDate')} />
        </div>
        <div data-testid="transport-trip-departure-time">
          <TextField
            {...form.getFieldProps('departureTime')}
            isOptional={false}
            label={t('transport.trips.departureTime')}
            placeholder={t('transport.trips.timeExample')}
            spellCheck={false}
          />
        </div>
      </div>
    </TransportFormFrame>
  );
};

export const TransportEditor = (props: TransportEditorProps): ReactElement => props.kind === 'offer'
  ? <OfferEditor {...props} />
  : <AssignmentEditor {...props} />;
