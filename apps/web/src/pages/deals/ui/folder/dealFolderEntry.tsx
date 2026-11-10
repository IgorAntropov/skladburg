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

import { getDealFulfillmentAction } from '../../lib/dealFulfillment';
import { dealFolderSection } from './dealFolderSection';
import { DealFulfillmentButton } from './DealFulfillmentButton';
import { DealPayment } from './DealPayment';
import { DealDocuments } from './documents/DealDocuments';

export const DealFolder = ({
  deal,
  documentFocusRequest,
  initialDocumentId,
  onFocusStatus,
  onRefresh,
  onUpdated,
  party,
  transportCard,
}: DealFolderProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealFolderSection);
  const action = getDealFulfillmentAction(deal.status, deal.deliveryMethod, party);

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
      {action !== undefined && (
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
