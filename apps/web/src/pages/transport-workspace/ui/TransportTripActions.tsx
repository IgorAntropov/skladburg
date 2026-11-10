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
  useConfirmTransportOrder,
} from '../api/useTransportWorkspaceCommands';
import { useTransportEditorSlot } from './TransportEditorSlot';

interface TransportTripActionsProps {
  onStatusFocus: () => void;
  t: TransportTranslate;
  trip: Trip;
}

const ConfirmOrder = ({ onStatusFocus, t, trip }: TransportTripActionsProps): ReactElement => {
  const access = useCommandAccess(transportMethods.confirmTransportOrder, { kind: 'organization' });
  const announce = useAnnounce();
  const refresh = useRefreshTransport();
  const commandRef = useRef<HTMLDivElement>(null);

  const handleSaved = (): void => {
    announce(t('transport.trips.confirmedNotice'));
    if (commandRef.current?.contains(document.activeElement) === true) {
      onStatusFocus();
    }
    void refresh();
  };
  const command = useConfirmTransportOrder(trip.id, trip.version, handleSaved);

  const isConflict = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const handleRefresh = (): void => {
    void refresh();
  };

  useRefreshOnVersionConflict(command, refresh);

  return (
    <div className="flex flex-col gap-2" ref={commandRef}>
      <ActionButton access={access} command={command} data-testid="transport-order-confirm" isDisabled={isConflict}>
        {t('transport.trips.confirm')}
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
    return <ConfirmOrder key={trip.version} onStatusFocus={onStatusFocus} t={t} trip={trip} />;
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
