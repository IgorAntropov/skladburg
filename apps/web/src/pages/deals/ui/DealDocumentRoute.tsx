import type {
  ComponentType,
  ReactElement,
} from 'react';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { FolderOpen } from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';

import { useDocumentIndexQuery } from '@/entities/document';
import {
  useCan,
  useSessionQuery,
} from '@/entities/session';
import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { useAddress } from '@/shared/routing';
import { EmptyState } from '@/shared/ui';

import type { DealsPageContentProps } from './DealsPage';

interface DealDocumentRouteProps {
  focus: ObjectRefValue;
  Page: ComponentType<DealsPageContentProps>;
}

export const DealDocumentRoute = ({ focus, Page }: DealDocumentRouteProps): ReactElement => {
  const { t } = useI18n();
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const hasDocumentPermission = useCan(PermissionCode.DOCUMENT_VIEW, { kind: 'organization' });
  const { isPending: isSessionPending } = useSessionQuery();
  const { focusRequest } = useAddress();
  const canViewDocuments = canViewDeals && hasDocumentPermission;
  const { data, error, isFetching, isSuccess, refetch } = useDocumentIndexQuery(canViewDocuments);
  const isReadDenied = isReadAccessDenied(error);
  const dealId = canViewDocuments && !isReadDenied ? data?.find(entry => entry.document.id === focus.id)?.dealId : undefined;
  const isUnavailable = !isSessionPending && (
    !canViewDocuments || isReadDenied || (isSuccess && !isFetching && dealId === undefined)
  );
  const unavailable = (
    <EmptyState data-testid="deal-document-unavailable" icon={FolderOpen} text={t('routing.objectUnavailable.title')} />
  );
  const documentRoute = { dealId, documentId: focus.id, error, focusRequest, isFetching, isUnavailable, refetch, unavailable };

  return <Page documentRoute={documentRoute} focus={focus} />;
};
