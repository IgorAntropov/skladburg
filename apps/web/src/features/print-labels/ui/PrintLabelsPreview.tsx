import type {
  KeyboardEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';

import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { getAppBaseUrl } from '@/shared/routing';
import {
  Button,
  ChunkLoadNotice,
  Skeleton,
  SkeletonGroup,
} from '@/shared/ui';

import type { PrintPageValue } from '../lib/printPageTypes';

import { printLabelsSection } from '../i18n/printLabelsSection';
import { buildPrintDocument } from '../lib/buildPrintDocument';

interface PrintLabelsPreviewProps {
  getPages: () => Promise<readonly PrintPageValue[]> | readonly PrintPageValue[];
  label: string;
  onClose: () => void;
}

type PrintStatusValue = { html: string; kind: 'ready' } | { kind: 'failed' | 'pending' };

export const PrintLabelsPreview = ({ getPages, label, onClose }: PrintLabelsPreviewProps): ReactElement => {
  const { locale, t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(printLabelsSection);
  const [prepare] = useState(() => getPages);
  const [printStatus, setPrintStatus] = useState<PrintStatusValue>({ kind: 'pending' });
  const [attempt, setAttempt] = useState(0);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
    }
  };

  const handleFrameKeyDown = (event: globalThis.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const handleRetry = (): void => {
    setIsFrameReady(false);
    setPrintStatus({ kind: 'pending' });
    setAttempt(prev => prev + 1);
  };

  const handleFrameLoad = (): void => {
    const article = frameRef.current?.contentDocument?.querySelector('article');
    if (article === null || article === undefined) {
      return;
    }
    const frameDocument = article.ownerDocument;
    frameDocument.addEventListener('keydown', handleFrameKeyDown);
    const hasImages = Array.from(frameDocument.images).every(image => image.complete && image.naturalWidth > 0);
    if (hasImages) {
      setIsFrameReady(true);
    }
    else {
      setPrintStatus({ kind: 'failed' });
    }
  };

  const handlePrint = (): void => {
    if (isFrameReady) {
      frameRef.current?.contentWindow?.print();
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      dialog?.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(prepare).then(pages => buildPrintDocument(pages, getAppBaseUrl(), locale, label, controller.signal)).then(
      (html) => {
        if (!controller.signal.aborted) {
          setPrintStatus({ html, kind: 'ready' });
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setPrintStatus({ kind: 'failed' });
        }
      },
    );

    return () => {
      controller.abort();
    };
  }, [attempt, label, locale, prepare]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[min(96vw,48rem)] overflow-auto rounded-panel border border-line bg-panel-solid p-4 text-on-panel"
      data-testid="print-labels-preview"
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" id={titleId}>{t?.('printLabels.preview') ?? label}</h2>
          <Button data-testid="print-labels-close" onClick={onClose} ref={closeRef} variant="secondary">
            {t?.('printLabels.close') ?? baseText('hud.inspector.close')}
          </Button>
        </div>
        {t === undefined && status === 'error' && (
          <ChunkLoadNotice
            message={baseText('routing.chunkError.message')}
            onRetry={retry}
            recovery="retry"
            repeatedMessage={baseText('routing.chunkError.repeated')}
          />
        )}
        {printStatus.kind === 'pending' && (
          <SkeletonGroup isFilled label={t?.('printLabels.loading') ?? baseText('routing.section.loading')}>
            <Skeleton className="h-56 w-full" />
          </SkeletonGroup>
        )}
        {printStatus.kind === 'failed' && t !== undefined && (
          <ChunkLoadNotice
            message={t('printLabels.failed')}
            onRetry={handleRetry}
            recovery="retry"
            repeatedMessage={t('printLabels.failed')}
          />
        )}
        {printStatus.kind === 'ready' && (
          <iframe
            className="h-[min(55dvh,32rem)] w-full rounded-control border border-line bg-panel-solid"
            data-testid="print-labels-frame"
            onLoad={handleFrameLoad}
            ref={frameRef}
            sandbox="allow-same-origin allow-modals"
            srcDoc={printStatus.html}
            title={t?.('printLabels.preview') ?? label}
          />
        )}
        {t !== undefined && (
          <Button
            className="self-start"
            data-testid="print-labels-submit"
            disabled={!isFrameReady}
            onClick={handlePrint}
            variant="primary"
          >
            {t('printLabels.submit')}
          </Button>
        )}
      </div>
    </dialog>
  );
};
