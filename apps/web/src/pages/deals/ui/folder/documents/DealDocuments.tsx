import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import {
  ArrowRight,
  ChevronLeft,
  FileText,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { DocumentTypeTranslate } from '@/entities/document';

import {
  documentListMethod,
  documentTypeSection,
  getDocumentTypeLabel,
  useDealDocumentQuery,
  useDealDocumentsQuery,
} from '@/entities/document';
import { useCommandAccess } from '@/entities/session';
import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
  EmptyState,
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
  WidgetStates,
} from '@/shared/ui';

import type { DealDocumentTranslate } from './documentSection';

import { DealDocumentStatus } from './DealDocumentStatus';
import { formatDocumentNumberAndDate } from './documentLabels';
import { dealDocumentSection } from './documentSection';

interface DealDocumentPanelProps extends DealDocumentsProps {
  documentId: string;
  documentTypeT: DocumentTypeTranslate;
  onRequestHeadingFocus: () => void;
  onRetryChunk: () => void;
  state: ReturnType<typeof useChunkLoader<Awaited<ReturnType<typeof loadDocumentView>>>>['state'];
  t: DealDocumentTranslate;
}

interface DealDocumentsBodyProps extends DealDocumentsProps {
  documentTypeT: DocumentTypeTranslate;
  t: DealDocumentTranslate;
}

interface DealDocumentsProps {
  deal: Deal;
  initialDocumentId?: string | undefined;
  onRefresh: () => void;
}

const loadDocumentView = createCachedModuleLoader(() => import('./documentViewEntry'));

const DealDocumentPanel = ({
  deal,
  documentId,
  documentTypeT,
  onRefresh,
  onRequestHeadingFocus,
  onRetryChunk,
  state,
  t,
}: DealDocumentPanelProps): ReactElement => {
  const { t: baseText } = useI18n();
  const query = useDealDocumentQuery(deal.id, documentId);

  if (state.kind === 'failed') {
    return (
      <ChunkLoadNotice
        message={baseText('routing.chunkError.message')}
        onRetry={onRetryChunk}
        recovery={state.recovery}
        repeatedMessage={baseText('routing.chunkError.repeated')}
      />
    );
  }

  const isReady = state.kind === 'loaded';
  const document = isReady && !isReadAccessDenied(query.error) ? query.data : undefined;

  const handleRefreshDocument = async (): Promise<boolean> => (await query.refetch()).isSuccess;

  const handleRetry = (): void => {
    void handleRefreshDocument();
  };

  return (
    <WidgetStates
      data={document}
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={t('dealDocument.loadingView')}
      onRetry={handleRetry}
      skeleton={<Skeleton className="h-48 w-full" shape="block" />}
    >
      {current => isReady && (
        <state.module.DealDocumentView
          deal={deal}
          document={current}
          heading={getDocumentTypeLabel(current.type, documentTypeT)}
          isRefreshing={query.isFetching}
          onRefresh={onRefresh}
          onRefreshDocument={handleRefreshDocument}
          onRequestHeadingFocus={onRequestHeadingFocus}
          t={t}
        />
      )}
    </WidgetStates>
  );
};

const DealDocumentsBody = ({ deal, documentTypeT, initialDocumentId, onRefresh, t }: DealDocumentsBodyProps): ReactElement => {
  const { formatCalendarDate } = useI18n();
  const query = useDealDocumentsQuery(deal.id);
  const headingId = useId();
  const { load, state } = useChunkLoader(loadDocumentView);
  const [selectedDocumentId, setSelectedDocumentId] = useState(initialDocumentId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<string | undefined>(undefined);

  const isReadDenied = isReadAccessDenied(query.error);
  const documents = isReadDenied ? undefined : query.data;
  const selectedDocument = documents?.find(item => item.id === selectedDocumentId);

  const handleOpen = (documentId: string): void => {
    setSelectedDocumentId(documentId);
  };

  const handleBack = (): void => {
    returnFocusRef.current = selectedDocumentId;
    setSelectedDocumentId(undefined);
  };

  const handleRetry = (): void => {
    void query.refetch();
  };

  const handleHeadingFocus = (): void => {
    headingRef.current?.focus();
  };

  useEffect(() => {
    if (selectedDocumentId !== undefined) {
      load();
    }
  }, [load, selectedDocumentId]);

  useLayoutEffect(() => {
    if (selectedDocumentId !== undefined) {
      headingRef.current?.focus();
      return;
    }

    const documentId = returnFocusRef.current;
    if (documentId !== undefined) {
      returnFocusRef.current = undefined;
      const button = listRef.current?.querySelector<HTMLButtonElement>(`[data-document-id="${CSS.escape(documentId)}"]`);
      (button ?? headingRef.current)?.focus();
    }
  }, [selectedDocumentId]);

  if (selectedDocumentId !== undefined) {
    return (
      <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3" data-testid="deal-document-view">
        <Button className="self-start" data-testid="deal-document-back" onClick={handleBack} variant="link">
          <ChevronLeft aria-hidden className="size-4 shrink-0" />
          {t('dealDocument.back')}
        </Button>
        <h3 className="text-lg font-semibold" id={headingId} ref={headingRef} tabIndex={-1}>
          {getDocumentTypeLabel(selectedDocument?.type, documentTypeT)}
        </h3>
        {isReadDenied
          ? <p role="alert">{t('dealDocument.unavailable')}</p>
          : (
              <DealDocumentPanel
                deal={deal}
                documentId={selectedDocumentId}
                documentTypeT={documentTypeT}
                onRefresh={onRefresh}
                onRequestHeadingFocus={handleHeadingFocus}
                onRetryChunk={load}
                state={state}
                t={t}
              />
            )}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2" data-testid="deal-documents">
      <h3 className="text-base font-semibold" id={headingId} ref={headingRef} tabIndex={-1}>{t('dealDocument.heading')}</h3>
      <WidgetStates
        data={documents}
        empty={<EmptyState icon={FileText} text={t('dealDocument.empty')} />}
        error={query.error}
        isEmpty={items => items.length === 0}
        isRetrying={query.isFetching}
        loadingLabel={t('dealDocument.loadingList')}
        onRetry={handleRetry}
        skeleton={(
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" shape="block" />
            <Skeleton className="h-20 w-full" shape="block" />
            <Skeleton className="h-20 w-full" shape="block" />
          </div>
        )}
      >
        {items => (
          <ul className="divide-y divide-line" ref={listRef}>
            {items.map(item => (
              <li key={item.id}>
                <Button
                  className="w-full justify-start px-2 text-left"
                  data-document-id={item.id}
                  data-number={item.number === 0 ? '' : item.number}
                  data-status={item.status}
                  data-testid={`deal-document-${String(item.type)}`}
                  onClick={() => { handleOpen(item.id); }}
                  variant="neutral"
                >
                  <FileText aria-hidden className="size-5 shrink-0 text-on-panel-muted" />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 wrap-break-word">
                    <span>{getDocumentTypeLabel(item.type, documentTypeT)}</span>
                    <span className="text-sm font-normal text-on-panel-muted">
                      {formatDocumentNumberAndDate(item.displayNumber, item.date, formatCalendarDate, t)}
                    </span>
                    <DealDocumentStatus status={item.status} t={t} type={item.type} />
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </WidgetStates>
    </section>
  );
};

export const DealDocuments = (props: DealDocumentsProps): null | ReactElement => {
  const { t: baseText } = useI18n();
  const { organizationId, userId } = useActingContext();
  const access = useCommandAccess(documentListMethod, { kind: 'organization' });
  const { retry, status, t } = useCatalogSection(dealDocumentSection);
  const typeCatalog = useCatalogSection(documentTypeSection);

  if (access.status !== 'allowed' || organizationId === undefined || userId === undefined) {
    return null;
  }

  if (t !== undefined && typeCatalog.t !== undefined) {
    const scope = `${organizationId}:${userId}:${props.deal.id}:${props.initialDocumentId ?? ''}`;

    return <DealDocumentsBody {...props} documentTypeT={typeCatalog.t} key={scope} t={t} />;
  }

  if (status === 'error' || typeCatalog.status === 'error') {
    return <ErrorNotice error={null} onRetry={status === 'error' ? retry : typeCatalog.retry} />;
  }

  return (
    <SkeletonGroup isFilled label={baseText('routing.section.loading')}>
      <Skeleton className="h-20 w-full" shape="block" />
    </SkeletonGroup>
  );
};
