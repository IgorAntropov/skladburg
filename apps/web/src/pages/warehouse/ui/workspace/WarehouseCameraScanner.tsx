import type { ReactElement } from 'react';

import { TriangleAlert } from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';

import { Button } from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { CameraErrorValue } from '../../model/scan/camera/startCameraScanner';
import type { WarehouseScanErrorValue } from '../../model/scan/resolveReceivingScan';

import { startCameraScanner } from '../../model/scan/camera/startCameraScanner';

type CameraStateValue = { kind: 'active' | 'paused' | 'starting' } | { kind: 'failed'; message: CameraErrorValue };

interface WarehouseCameraScannerProps {
  onClose: () => void;
  onCode: (raw: string) => undefined | WarehouseScanErrorValue;
  t: WarehouseWorkTranslate;
}

const createWorker = (): Worker =>
  new Worker(new URL('../../model/scan/camera/cameraDecoder.worker.ts', import.meta.url), { type: 'module' });

let pauseActiveCamera: (() => void) | undefined;

export const WarehouseCameraScanner = ({ onClose, onCode, t }: WarehouseCameraScannerProps): ReactElement => {
  const [state, setState] = useState<CameraStateValue>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState<undefined | WarehouseScanErrorValue>();
  const headingId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleCode = useEffectEvent((raw: string): void => {
    const error = onCode(raw);
    setFeedback(error);
    if (error === undefined) {
      setCount(prev => prev + 1);
    }
  });

  const handleRestart = (): void => {
    console.log('> WarehouseCameraScanner -> handleRestart:', {});
    setFeedback(undefined);
    setState({ kind: 'starting' });
    setAttempt(prev => prev + 1);
    closeRef.current?.focus();
  };

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return undefined;
    }
    const controller = new AbortController();

    const handlePause = (): void => {
      controller.abort();
      if (pauseActiveCamera === handlePause) {
        pauseActiveCamera = undefined;
      }
      setState({ kind: 'paused' });
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        handlePause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePause);
    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return;
      }
      if (document.hidden) {
        handlePause();
        return;
      }
      pauseActiveCamera?.();
      pauseActiveCamera = handlePause;
      void startCameraScanner({
        createWorker,
        onCode: handleCode,
        onError: (message) => {
          if (pauseActiveCamera === handlePause) {
            pauseActiveCamera = undefined;
          }
          setState({ kind: 'failed', message });
        },
        onReady: () => { setState({ kind: 'active' }); },
        signal: controller.signal,
        video,
      });
    });

    return () => {
      controller.abort();
      if (pauseActiveCamera === handlePause) {
        pauseActiveCamera = undefined;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePause);
    };
  }, [attempt]);

  const isPreview = state.kind === 'active' || state.kind === 'starting';
  const canRestart = state.kind === 'failed' || state.kind === 'paused';

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full min-w-0 max-w-lg flex-col gap-2 rounded-control border border-line bg-panel-solid p-3"
      data-testid="warehouse-camera-scanner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold" id={headingId}>{t('warehouseWork.cameraTitle')}</h4>
        <Button data-testid="warehouse-camera-close" onClick={onClose} ref={closeRef} variant="secondary">
          {t('warehouseWork.close')}
        </Button>
      </div>
      <video
        aria-hidden
        autoPlay
        className="aspect-video w-full max-w-full rounded-control bg-panel object-contain"
        data-testid="warehouse-camera-video"
        hidden={!isPreview}
        muted
        playsInline
        ref={videoRef}
      />
      <p className="text-sm text-on-panel-muted" role="status">
        {state.kind === 'starting' && t('warehouseWork.cameraStarting')}
        {state.kind === 'active' && (feedback === undefined ? t('warehouseWork.cameraCount', { count }) : t(feedback))}
        {state.kind === 'paused' && t('warehouseWork.cameraPaused')}
      </p>
      {state.kind === 'active' && <p className="text-sm">{t('warehouseWork.cameraAim')}</p>}
      {state.kind === 'failed' && (
        <p className="flex items-start gap-2 text-sm" role="alert">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(state.message)}
        </p>
      )}
      {canRestart && (
        <Button className="self-start" data-testid="warehouse-camera-restart" onClick={handleRestart} variant="secondary">
          {t('warehouseWork.cameraRestart')}
        </Button>
      )}
    </section>
  );
};
