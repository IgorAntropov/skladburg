import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import type { DealCommandContextValue } from '../../api/commands/dealCommandContext';
import type { DealInspectorTranslate } from '../../i18n/inspectorSection';
import type { DealEditorValue } from './dealInspectorTypes';

import { useDealCommandAccess } from '../../api/commands/useDealCommandAccess';
import {
  getDealReceiptMethod,
  useDealReceipt,
} from '../../api/useDealReceipt';
import { dealInspectorSection } from '../../i18n/inspectorSection';
import { shouldReadDealReceipt } from '../../lib/dealReceiptActions';
import { DealStatusBadge } from '../DealStatusBadge';
import { DealTrackerSlot } from '../DealTrackerSlot';
import { DealFolderSlot } from '../folder/DealFolderSlot';
import { DealTransportSlot } from '../transport/DealTransportSlot';
import { ApproveDealButton } from './ApproveDealButton';
import { getDealActions } from './dealActionAvailability';
import { DealActionOpenButton } from './DealActionOpenButton';
import { DealEditor } from './DealEditor';
import { DealHistory } from './DealHistory';
import { DealTerms } from './DealTerms';

interface DealInspectorBodyProps extends DealInspectorProps {
  t: DealInspectorTranslate;
}

interface DealInspectorProps extends DealCommandContextValue {
  counterpartyName: string | undefined;
  documentFocusRequest?: number | undefined;
  initialDocumentId?: string | undefined;
}

const DealInspectorBody = ({
  counterpartyName,
  deal,
  documentFocusRequest,
  initialDocumentId,
  onRefresh,
  onUpdated,
  t,
}: DealInspectorBodyProps): ReactElement => {
  const { organizationId } = useActingContext();
  const { data: session } = useSessionQuery();
  const isCustomer = organizationId === deal.customerOrganizationId;
  const isSupplier = organizationId === deal.supplierOrganizationId;
  const party = isCustomer ? 'customer' : (isSupplier ? 'supplier' : undefined);
  const receiptAccess = useDealCommandAccess(getDealReceiptMethod);
  const shouldReadReceipt = shouldReadDealReceipt(deal.status, party);
  const canReadReceipt = shouldReadReceipt && receiptAccess.status === 'allowed';
  const receiptQuery = useDealReceipt(deal.id, canReadReceipt);

  const [editor, setEditor] = useState<DealEditorValue | undefined>(undefined);
  const actionListRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<'status' | DealEditorValue | undefined>(undefined);

  const isReceiptReadDenied = isReadAccessDenied(receiptQuery.error);
  const receipt = canReadReceipt && !isReceiptReadDenied ? receiptQuery.data?.receipt : undefined;
  const isReceiptLoading = shouldReadReceipt && (receiptAccess.status === 'checking' || (canReadReceipt && receiptQuery.isPending));
  const canOfferManualShipment = receiptAccess.status === 'denied' || isReceiptReadDenied || (canReadReceipt && receiptQuery.isSuccess);
  const isReceiptFailure = canReadReceipt && !isReceiptReadDenied && receiptQuery.error !== null;
  const canPublish = session !== undefined
    && isPermissionGranted(session.permissions, PermissionCode.TRANSPORT_REQUEST_CREATE, { kind: 'organization' });
  const actions = getDealActions(deal.status, party, deal.deliveryMethod, canPublish);
  const hasActions = editor === undefined && actions.length > 0;
  const hasFolder = deal.deliveryMethod !== DeliveryMethod.UNSPECIFIED;
  const hasTransportRequest = deal.deliveryMethod === DeliveryMethod.EXCHANGE && party !== undefined;
  const ownCompany = session?.organizations.find(organization => organization.id === organizationId)?.name
    ?? t('dealInspector.ownCompany');
  const otherCompany = counterpartyName ?? t('dealInspector.notSpecified');

  const handleRetryReceipt = (): void => {
    console.log('> DealInspector -> handleRetryReceipt:', {});
    void receiptQuery.refetch();
  };

  const handleRefreshReceipt = (): void => {
    onRefresh();
    if (canReadReceipt) {
      handleRetryReceipt();
    }
  };

  const handleClose = (): void => {
    pendingFocusRef.current = editor;
    setEditor(undefined);
  };

  const handleUpdated = (updated: Deal): void => {
    if (editor !== undefined && editorRef.current?.contains(document.activeElement) === true) {
      const currentActions = getDealActions(updated.status, party, updated.deliveryMethod, canPublish);
      pendingFocusRef.current = currentActions.includes(editor) ? editor : 'status';
    }

    onUpdated(updated);
    setEditor(undefined);
  };

  const handleRequestStatusFocus = (): void => {
    pendingFocusRef.current = 'status';
  };

  const handleFocusStatus = (): void => {
    statusRef.current?.focus();
  };

  const handlePublished = (): void => {
    if (editorRef.current?.contains(document.activeElement) === true) {
      pendingFocusRef.current = 'status';
    }
    onRefresh();
    setEditor(undefined);
  };

  const handleOpenPublish = (): void => {
    setEditor('publishTransport');
  };

  useLayoutEffect(() => {
    const target = pendingFocusRef.current;
    if (editor !== undefined || target === undefined) {
      return;
    }

    pendingFocusRef.current = undefined;
    const action = target === 'status'
      ? undefined
      : actionListRef.current?.querySelector<HTMLButtonElement>(`[data-deal-action="${target}"]`);
    (action ?? statusRef.current)?.focus();
  }, [deal.status, editor]);

  return (
    <div className="flex min-w-0 flex-col gap-4 text-on-panel">
      <div className="self-start" data-status={deal.status} data-testid="deal-status" ref={statusRef} tabIndex={-1}>
        <DealStatusBadge status={deal.status} />
      </div>
      <DealTrackerSlot deal={deal} receipt={receipt} />
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap justify-between gap-x-2 wrap-break-word">
          <dt className="text-on-panel-muted">{t('dealInspector.customer')}</dt>
          <dd className="font-medium">{isCustomer ? ownCompany : otherCompany}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-2 wrap-break-word">
          <dt className="text-on-panel-muted">{t('dealInspector.supplier')}</dt>
          <dd className="font-medium">{isSupplier ? ownCompany : otherCompany}</dd>
        </div>
      </dl>
      <DealTerms deal={deal} t={t} />
      {hasTransportRequest && <DealTransportSlot dealId={deal.id} kind="request" />}
      {hasFolder && (
        <DealFolderSlot
          canOfferManualShipment={canOfferManualShipment}
          deal={deal}
          documentFocusRequest={documentFocusRequest}
          initialDocumentId={initialDocumentId}
          isReceiptLoading={isReceiptLoading}
          onFocusStatus={handleFocusStatus}
          onRefresh={handleRefreshReceipt}
          onRetryReceipt={handleRetryReceipt}
          onUpdated={handleUpdated}
          party={party}
          receipt={receipt}
          receiptError={isReceiptFailure ? receiptQuery.error : null}
          transportCard={hasTransportRequest ? <DealTransportSlot dealId={deal.id} kind="trip" /> : undefined}
        />
      )}
      {editor !== undefined && (
        <div ref={editorRef}>
          <DealEditor
            action={editor}
            deal={deal}
            isCurrentAction={actions.includes(editor)}
            onClose={handleClose}
            onPublished={handlePublished}
            onRefresh={onRefresh}
            onUpdated={handleUpdated}
            t={t}
          />
        </div>
      )}
      {hasActions && (
        <section className="flex flex-col gap-2" ref={actionListRef}>
          <h3 className="text-base font-semibold">{t('dealInspector.actions')}</h3>
          {actions.map((action) => {
            if (action === 'publishTransport') {
              return <DealTransportSlot key={action} kind="publish" onOpen={handleOpenPublish} />;
            }
            if (action === 'submit' || action === 'accept') {
              return (
                <ApproveDealButton
                  deal={deal}
                  key={`${action}-${String(deal.version)}`}
                  kind={action === 'submit' ? 'submitDeal' : 'acceptCounterOffer'}
                  onRefresh={onRefresh}
                  onRequestStatusFocus={handleRequestStatusFocus}
                  onUpdated={onUpdated}
                  t={t}
                />
              );
            }
            return <DealActionOpenButton action={action} deal={deal} key={action} onOpen={setEditor} t={t} />;
          })}
        </section>
      )}
      <DealHistory deal={deal} t={t} />
    </div>
  );
};

export const DealInspector = (props: DealInspectorProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealInspectorSection);

  if (t !== undefined) {
    return <DealInspectorBody {...props} key={props.deal.id} t={t} />;
  }

  if (status === 'error') {
    return <ErrorNotice error={null} onRetry={retry} />;
  }

  return (
    <SkeletonGroup isFilled label={baseText('object.type.deal')}>
      <Skeleton shape="block" />
    </SkeletonGroup>
  );
};
