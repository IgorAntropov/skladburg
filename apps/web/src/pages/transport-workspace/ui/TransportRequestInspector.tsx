import type { TransportRequest } from '@skladburg/contracts/logistics/v1/logistics';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import {
  ClipboardPen,
  Truck,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useCan,
  useCommandAccess,
} from '@/entities/session';
import {
  useRefreshTransport,
  useTransportRequest,
  useTrip,
} from '@/entities/transport';
import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  AccessButton,
  TextLink,
} from '@/shared/ui';

import type { TransportInspectorProps } from './TransportInspectorSlot';

import { transportMethods } from '../api/useTransportWorkspaceCommands';
import { TransportCargoDetails } from './TransportCargoDetails';
import { TransportData } from './TransportData';
import { useTransportEditorSlot } from './TransportEditorSlot';
import { TransportProperty } from './TransportProperty';
import { TransportRequestOffers } from './TransportRequestOffers';
import { TransportRoute } from './TransportRoute';
import { TransportStatus } from './TransportStatus';

interface RequestContentProps extends TransportInspectorProps {
  request: TransportRequest;
}

const RequestContent = ({ formatTime, id, readCity, request, t }: RequestContentProps): ReactElement => {
  const { locale } = useI18n();
  const { organizationId } = useActingContext();
  const refresh = useRefreshTransport();
  const canViewTrips = useCan(PermissionCode.TRIP_VIEW, { kind: 'organization' });
  const access = useCommandAccess(transportMethods.submitTransportOffer, { kind: 'organization' });
  const { perspective, summary } = request;
  const isSelected = summary?.status === TransportRequestStatus.SELECTED;
  const trip = useTrip(id, isSelected && canViewTrips);
  const statusRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const shouldReturnFocus = useRef(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const isOpen = summary?.status === TransportRequestStatus.OPEN;
  const isCarrier = perspective.case === 'carrier';
  const isShipper = perspective.case === 'deal' && organizationId === perspective.value.shipperOrganizationId;
  const ownOffer = isCarrier ? perspective.value.ownOffer : undefined;
  const selectedOffer = isShipper ? perspective.value.selectedOffer : undefined;
  const canSubmitOffer = isCarrier && isOpen && ownOffer === undefined;
  const isTripLinkShown = isSelected && canViewTrips && trip.data !== undefined && !isReadAccessDenied(trip.error);
  const displayedOffer = ownOffer ?? selectedOffer;

  const handleClose = (): void => {
    shouldReturnFocus.current = true;
    setIsEditorOpen(false);
  };

  const handleStatusFocus = (): void => {
    statusRef.current?.focus();
  };

  const handleSaved = (): void => {
    setIsEditorOpen(false);
    handleStatusFocus();
    void refresh();
  };

  const slot = useTransportEditorSlot({
    isCurrentAction: canSubmitOffer,
    kind: 'offer',
    onClose: handleClose,
    onRefresh: refresh,
    onSaved: handleSaved,
    requestId: id,
    t,
  });

  const handleOpen = (): void => {
    setIsEditorOpen(true);
    slot.open();
  };

  useEffect(() => {
    if (!isEditorOpen && shouldReturnFocus.current) {
      shouldReturnFocus.current = false;
      (openRef.current ?? statusRef.current)?.focus();
    }
  }, [isEditorOpen]);

  if (summary === undefined) {
    return <p role="status">{t('transport.unavailable')}</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-status={summary.status} data-testid="transport-request-inspector">
      <div ref={statusRef} tabIndex={-1}><TransportStatus kind="request" status={summary.status} t={t} /></div>
      <TransportRoute
        deliveryWindow={summary.deliveryWindow}
        formatTime={formatTime}
        from={readCity(summary.fromCityId)}
        pickupWindow={summary.pickupWindow}
        t={t}
        to={readCity(summary.toCityId)}
      />
      {isEditorOpen && slot.editor}
      {canSubmitOffer && !isEditorOpen && (
        <AccessButton access={access} data-testid="transport-offer-open" onClick={handleOpen} ref={openRef}>
          {t('transport.offers.open')}
        </AccessButton>
      )}
      {isTripLinkShown && (
        <TextLink
          className="self-start gap-2"
          data-testid="transport-request-trip-link"
          isFocusRequested
          to={{ kind: 'object', object: { id, type: 'trip' } }}
        >
          <Truck aria-hidden className="size-4" />
          {t('transport.trips.link')}
        </TextLink>
      )}
      {displayedOffer?.amount !== undefined && (
        <dl className="rounded-control border border-line p-3">
          <TransportProperty label={t(isCarrier ? 'transport.offers.own' : 'transport.offers.selected')}>
            <span className="font-semibold tabular-nums">{formatMoney(locale, displayedOffer.amount)}</span>
          </TransportProperty>
        </dl>
      )}
      {isShipper && isOpen && (
        <TransportRequestOffers
          onRefresh={refresh}
          onStatusFocus={handleStatusFocus}
          requestId={id}
          t={t}
          version={perspective.value.version}
        />
      )}
      {summary.cargo !== undefined && <TransportCargoDetails cargo={summary.cargo} t={t} />}
    </div>
  );
};

export const TransportRequestInspector = (props: TransportInspectorProps): ReactElement => {
  const { id, t } = props;
  const query = useTransportRequest(id, true);

  return (
    <TransportData icon={ClipboardPen} query={query} t={t} unavailableTestId="transport-request-unavailable">
      {request => <RequestContent {...props} request={request} />}
    </TransportData>
  );
};
