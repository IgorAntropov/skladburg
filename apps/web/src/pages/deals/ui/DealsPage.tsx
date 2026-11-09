import type {
  Deal,
  GetDealResponse,
} from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { GetDealResponseSchema } from '@skladburg/contracts/deal/v1/deal';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';

import { useMapSitesQuery } from '@/entities/network';
import {
  useCan,
  useSessionQuery,
} from '@/entities/session';
import {
  isReadAccessDenied,
  useActingContext,
  useApiClient,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  createCachedModuleLoader,
  createLazyComponent,
} from '@/shared/lib/module-loader';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  Button,
  EmptyState,
  SkeletonGroup,
  WidgetStates,
} from '@/shared/ui';
import {
  HudLayout,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';
import { ScenePlaceholder } from '@/widgets/scene-viewport';

import { createDealQueryOptions } from '../api/dealQueryOptions';
import { dealKeys } from '../api/dealQueryScope';
import { dealsSection } from '../i18n/dealsSection';
import { getDealCounterpartyId } from '../lib/getDealCounterpartyId';
import {
  DealInspectorSkeleton,
  DealInspectorSlot,
} from './DealInspectorSlot';
import {
  DealsBoard,
  DealsBoardSkeleton,
} from './DealsBoard';
import { DealTracker } from './DealTracker';

export interface DealsPageContentProps extends DealsPageProps {
  documentRoute: DocumentRouteValue | undefined;
}

interface DealsPageProps {
  focus: ObjectRefValue | undefined;
}

interface DocumentRouteValue {
  dealId: string | undefined;
  documentId: string;
  error: Error | null;
  focusRequest: number;
  isFetching: boolean;
  isUnavailable: boolean;
  refetch: () => Promise<unknown>;
  unavailable: ReactElement;
}

const loadDealDocumentRoute = createCachedModuleLoader(() => import('./DealDocumentRoute').then(module => ({
  default: module.DealDocumentRoute,
})));
const DealDocumentRoute = createLazyComponent(loadDealDocumentRoute);

const DealsPageContent = ({ documentRoute, focus }: DealsPageContentProps): ReactElement => {
  const { t } = useI18n();
  const { retry, status, t: dealsT } = useCatalogSection(dealsSection);
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const canViewNetwork = useCan(PermissionCode.NETWORK_VIEW);
  const { isPending: isSessionPending } = useSessionQuery();
  const inspectorFocus = useInspectorFocus('deals', focus);
  const viewportClass = useViewportClass();

  const documentId = documentRoute?.documentId;
  const dealId = focus?.type === 'deal' ? focus.id : documentRoute?.dealId;
  const dealOptions = createDealQueryOptions({ client, organizationId, userId }, canViewDeals ? dealId : undefined);
  const dealQuery = useQuery(dealOptions);
  const { data: sites } = useMapSitesQuery(canViewDeals && canViewNetwork);

  const isUnavailable = !canViewDeals || documentRoute?.isUnavailable === true || isReadAccessDenied(dealQuery.error);
  const inspectorQuery = dealId === undefined && documentRoute !== undefined ? documentRoute : dealQuery;
  const deal = isUnavailable ? undefined : dealQuery.data?.deal;
  const organizationNames = new Map((canViewNetwork ? sites : undefined)?.map(site => [site.organizationId, site.organizationName]));
  const tracker = deal !== undefined && dealsT !== undefined ? <DealTracker deal={deal} t={dealsT} /> : undefined;

  const handleRefresh = (): void => {
    void inspectorQuery.refetch();
  };

  const handleUpdated = (updatedDeal: Deal): void => {
    const current = queryClient.getQueryState(dealOptions.queryKey);

    if (updatedDeal.id !== dealId || current === undefined || isReadAccessDenied(current.error)) {
      return;
    }

    queryClient.setQueryData<GetDealResponse>(dealOptions.queryKey, (prev) => {
      if (prev?.deal !== undefined && prev.deal.version > updatedDeal.version) {
        return prev;
      }

      return create(GetDealResponseSchema, { contract: prev?.contract, deal: updatedDeal });
    });
    void queryClient.invalidateQueries({ queryKey: dealKeys.list(organizationId, userId) });
  };

  const inspectorTitle = deal !== undefined && dealsT !== undefined ? dealsT('deals.number', { number: deal.number }) : undefined;
  const isLoading = (dealsT === undefined && status !== 'error') || isSessionPending;
  const board = ((): ReactElement => {
    if (isLoading) {
      return <SkeletonGroup isFilled label={t('routing.section.loading')}><DealsBoardSkeleton /></SkeletonGroup>;
    }
    if (dealsT === undefined) {
      return (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{t('routing.chunkError.message')}</p>
          <Button onClick={retry} variant="secondary">{t('common.retry')}</Button>
        </div>
      );
    }
    if (!canViewDeals || organizationId === undefined || userId === undefined) {
      return <EmptyState icon={ClipboardList} text={dealsT('deals.inspector.notFound')} />;
    }

    return (
      <DealsBoard
        key={`${organizationId}:${userId}:${dealId ?? ''}`}
        names={organizationNames}
        organizationId={organizationId}
        selectedId={dealId}
        t={dealsT}
        userId={userId}
      />
    );
  })();

  const inspector = (dealId === undefined && documentId === undefined) || dealsT === undefined
    ? undefined
    : (
        <div className="flex flex-col gap-3" data-testid="deal-inspector">
          {isUnavailable && !isSessionPending
            ? (documentRoute?.unavailable
              ?? <EmptyState data-testid="deal-unavailable" icon={ClipboardList} text={dealsT('deals.inspector.notFound')} />)
            : (
                <WidgetStates
                  data={deal}
                  error={inspectorQuery.error}
                  isRetrying={inspectorQuery.isFetching}
                  loadingLabel={dealsT('deals.loading')}
                  onRetry={handleRefresh}
                  skeleton={<DealInspectorSkeleton />}
                >
                  {current => (
                    <>
                      {viewportClass === 'phone' && tracker}
                      <DealInspectorSlot
                        counterpartyName={organizationNames.get(getDealCounterpartyId(current, organizationId ?? ''))}
                        deal={current}
                        documentFocusRequest={documentRoute?.focusRequest}
                        initialDocumentId={documentId}
                        key={`${organizationId ?? ''}:${userId ?? ''}:${current.id}`}
                        onRefresh={handleRefresh}
                        onUpdated={handleUpdated}
                      />
                    </>
                  )}
                </WidgetStates>
              )}
        </div>
      );

  return (
    <div className="contents" data-testid="page-deals">
      <HudLayout
        {...inspectorFocus}
        inspector={(
          <ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} title={inspectorTitle}>
            {inspector}
          </ObjectInspector>
        )}
        panel={(
          <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="deals-board">
            <h1 className="text-2xl font-semibold tracking-tight">{t('section.deals.title')}</h1>
            {dealsT !== undefined && <p className="text-on-panel-muted">{dealsT('deals.description')}</p>}
            {board}
          </div>
        )}
        scene={<ScenePlaceholder label={t('hud.scene.placeholder')} />}
        tracker={tracker}
      />
    </div>
  );
};

export const DealsPage = ({ focus }: DealsPageProps): ReactElement => (
  focus?.type === 'document'
    ? <DealDocumentRoute focus={focus} Page={DealsPageContent} />
    : <DealsPageContent documentRoute={undefined} focus={focus} />
);
