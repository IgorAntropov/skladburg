import type { ReactElement } from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import type { DealFolderProps } from './dealFolderTypes';

import {
  getDealFulfillmentAction,
  getFulfillmentMode,
} from '../../lib/dealFulfillment';
import { dealFolderSection } from './dealFolderSection';
import { DealFulfillmentButton } from './DealFulfillmentButton';
import { DealPayment } from './DealPayment';
import { DealDocuments } from './documents/DealDocuments';
import { DealWarehouseReceiptSlot } from './receipt/DealWarehouseReceiptSlot';

export const DealFolder = ({
  canOfferManualShipment,
  deal,
  documentFocusRequest,
  initialDocumentId,
  isReceiptLoading,
  onFocusStatus,
  onRefresh,
  onRetryReceipt,
  onUpdated,
  party,
  receipt,
  receiptError,
  transportCard,
}: DealFolderProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealFolderSection);
  const action = getDealFulfillmentAction(deal.status, deal.deliveryMethod, party);
  const mode = action === undefined ? undefined : getFulfillmentMode(action, deal, receipt, canOfferManualShipment);
  const isWarehouseAction = mode === 'warehouse';
  const isLegacyAction = action !== undefined && mode === 'manual';
  const isAwaitingAction = action !== undefined && mode === undefined && isReceiptLoading;

  if (t === undefined) {
    return status === 'error'
      ? <ErrorNotice error={null} onRetry={retry} />
      : <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-24" /></SkeletonGroup>;
  }

  return (
    <>
      <DealDocuments deal={deal} initialDocumentId={initialDocumentId} key={documentFocusRequest} onRefresh={onRefresh} />
      {transportCard}
      <DealPayment deal={deal} t={t} />
      {isAwaitingAction && (
        <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-11 w-36" /></SkeletonGroup>
      )}
      {receiptError !== null && <ErrorNotice error={receiptError} onRetry={onRetryReceipt} />}
      {(receipt?.updDocumentId !== undefined || isWarehouseAction) && (
        <DealWarehouseReceiptSlot
          deal={deal}
          isOutbound={isWarehouseAction && action === 'markDealShipped'}
          onFocusStatus={onFocusStatus}
          onRefresh={onRefresh}
          onUpdated={onUpdated}
          party={party}
          receipt={receipt}
        />
      )}
      {isLegacyAction && (
        <DealFulfillmentButton
          action={action}
          deal={deal}
          key={deal.version}
          onFocusStatus={onFocusStatus}
          onRefresh={onRefresh}
          onUpdated={onUpdated}
          t={t}
        />
      )}
    </>
  );
};
