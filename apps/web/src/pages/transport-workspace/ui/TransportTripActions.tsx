import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useCan,
  useCommandAccess,
} from '@/entities/session';
import { useRefreshTransport } from '@/entities/transport';
import {
  AccessButton,
  ActionButton,
  Button,
  useAnnounce,
} from '@/shared/ui';

import type { TransportTranslate } from '../i18n/transportSection';

import { useRefreshOnVersionConflict } from '../api/useRefreshOnVersionConflict';
import {
  transportMethods,
  tripStepMethods,
  useConfirmTripStep,
} from '../api/useTransportWorkspaceCommands';
import { useTransportEditorSlot } from './TransportEditorSlot';

interface ConfirmTripStepProps extends TransportTripActionsProps {
  method: Parameters<typeof useConfirmTripStep>[0];
}

interface TransportTripActionsProps {
  onStatusFocus: () => void;
  t: TransportTranslate;
  trip: Trip;
}

const ConfirmTripStep = ({ method, onStatusFocus, t, trip }: ConfirmTripStepProps): ReactElement => {
  const access = useCommandAccess(tripStepMethods[method], { kind: 'organization' });
  const announce = useAnnounce();
  const refresh = useRefreshTransport();
  const commandRef = useRef<HTMLDivElement>(null);
  const isCarrierTitle = method === 'submitCarrierTitle';

  const handleSaved = (): void => {
    announce(t(isCarrierTitle ? 'transport.trips.carrierTitleSubmitted' : 'transport.trips.confirmedNotice'));
    if (commandRef.current?.contains(document.activeElement) === true) {
      onStatusFocus();
    }
    void refresh();
  };
  const command = useConfirmTripStep(method, trip.id, trip.version, handleSaved);

  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const handleRefresh = (): void => {
    void refresh();
  };

  useRefreshOnVersionConflict(command, refresh);

  return (
    <div className="flex flex-col gap-2" ref={commandRef}>
      <ActionButton
        access={access}
        command={command}
        data-testid={isCarrierTitle ? 'transport-carrier-title-submit' : 'transport-order-confirm'}
        isDisabled={isConflict}
      >
        {t(isCarrierTitle ? 'transport.trips.submitCarrierTitle' : 'transport.trips.confirm')}
      </ActionButton>
      {isConflict && <Button className="self-start" onClick={handleRefresh} variant="secondary">{t('transport.form.refresh')}</Button>}
    </div>
  );
};

export const TransportTripActions = ({ onStatusFocus, t, trip }: TransportTripActionsProps): ReactElement | undefined => {
  const refresh = useRefreshTransport();
  const canViewFleet = useCan(PermissionCode.FLEET_VIEW, { kind: 'organization' });
  const access = useCommandAccess(transportMethods.assignTrip, { kind: 'organization' });
  const openRef = useRef<HTMLButtonElement>(null);
  const shouldReturnFocus = useRef(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const isAssignable = trip.status === TripStatus.CONFIRMED || trip.status === TripStatus.ASSIGNED;
  const canSubmitCarrierTitle = trip.carrierTitleSubmitted === false
    && (trip.status === TripStatus.LOADED || trip.status === TripStatus.IN_TRANSIT || trip.status === TripStatus.ARRIVED);
  const handleClose = (): void => {
    shouldReturnFocus.current = true;
    setIsEditorOpen(false);
  };
  const handleSaved = (): void => {
    setIsEditorOpen(false);
    onStatusFocus();
    void refresh();
  };
  const slot = useTransportEditorSlot({
    isCurrentAction: isAssignable && canViewFleet,
    kind: 'assignment',
    onClose: handleClose,
    onRefresh: refresh,
    onSaved: handleSaved,
    t,
    trip,
  });

  const handleOpen = (): void => {
    setIsEditorOpen(true);
    slot.open();
  };

  useEffect(() => {
    if (isEditorOpen || !shouldReturnFocus.current) {
      return;
    }

    shouldReturnFocus.current = false;
    if (openRef.current === null) {
      onStatusFocus();
    }
    else {
      openRef.current.focus();
    }
  }, [isEditorOpen, onStatusFocus]);

  if (isEditorOpen && canViewFleet) {
    return slot.editor;
  }

  if (trip.status === TripStatus.AWAITING_CONFIRMATION) {
    return (
      <ConfirmTripStep key={trip.version} method="confirmTransportOrder" onStatusFocus={onStatusFocus} t={t} trip={trip} />
    );
  }

  if (canSubmitCarrierTitle) {
    return <ConfirmTripStep key={trip.version} method="submitCarrierTitle" onStatusFocus={onStatusFocus} t={t} trip={trip} />;
  }

  if (!isAssignable) {
    return undefined;
  }

  return (
    <div className="flex flex-col gap-2">
      <AccessButton access={access} data-testid="transport-trip-assign-open" isDisabled={!canViewFleet} onClick={handleOpen} ref={openRef}>
        {t(trip.ownAssignment === undefined ? 'transport.trips.assign' : 'transport.trips.reassign')}
      </AccessButton>
      {!canViewFleet && <p className="text-sm text-on-panel-muted">{t('transport.trips.fleetDenied')}</p>}
    </div>
  );
};
