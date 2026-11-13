import type {
  FocusEvent,
  KeyboardEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  getAppBaseUrl,
  useNavigate,
} from '@/shared/routing';
import {
  Button,
  ChunkLoadNotice,
  TextField,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseScanErrorValue } from '../../model/scan/resolveReceivingScan';
import type { WarehouseScanHandlerValue } from './WarehouseScanner';

import {
  createKeyboardScan,
  WAREHOUSE_SCANNER_PROFILE,
} from '../../model/scan/keyboardScan';
import { parseWarehouseScan } from '../../model/scan/parseWarehouseScan';
import { readScannedCell } from '../../model/scan/readScannedCell';
import { readWarehouseQr } from '../../model/scan/readWarehouseQr';
import { resolveTaskReceivingScan } from '../../model/scan/resolveReceivingScan';

const loadCamera = createCachedModuleLoader(() => import('./WarehouseCameraScanner'));

export const scanTools = {
  readCell: readScannedCell,
  readUnit: (raw: string): string | undefined => {
    const scan = parseWarehouseScan(raw);
    return scan?.kind === 'unit' ? scan.sscc : undefined;
  },
  resolveReceiving: resolveTaskReceivingScan,
};

interface WarehouseScanInputProps {
  isReadOnly: boolean;
  onScan: WarehouseScanHandlerValue;
  t: WarehouseWorkTranslate;
}

export const WarehouseScanInput = ({ isReadOnly, onScan, t }: WarehouseScanInputProps): ReactElement => {
  const navigate = useNavigate();
  const { load, state } = useChunkLoader(loadCamera);
  const [scanner] = useState(() => createKeyboardScan(WAREHOUSE_SCANNER_PROFILE));
  const [feedback, setFeedback] = useState<'warehouseWork.scanMatched' | undefined | WarehouseScanErrorValue>();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);
  const hasError = feedback !== undefined && feedback !== 'warehouseWork.scanMatched';
  const Camera = state.kind === 'loaded' ? state.module.WarehouseCameraScanner : undefined;
  const isCameraVisible = isCameraOpen && !isReadOnly;
  const isCameraActive = isCameraVisible && Camera !== undefined;
  const isCameraTriggerDisabled = isReadOnly || isCameraActive;
  const isCameraLoading = isCameraVisible && state.kind === 'loading';

  if (isReadOnly && isCameraOpen) {
    setIsCameraOpen(false);
  }

  const handleScan = (raw: string, isCamera = false): undefined | WarehouseScanErrorValue => {
    const input = inputRef.current;
    if (input === null || isReadOnly || raw.trim() === '') {
      return 'warehouseWork.error.invalidCode';
    }
    const address = readWarehouseQr(raw, getAppBaseUrl());
    if (address !== undefined) {
      if (!isCamera) {
        input.value = '';
        setFeedback(undefined);
      }
      setIsCameraOpen(false);
      navigate(address, { isFocusRequested: true });
      return undefined;
    }
    const error = onScan(raw, scanTools);
    if (!isCamera) {
      setFeedback(error ?? 'warehouseWork.scanMatched');
      input.focus();
      if (error === undefined) {
        input.value = '';
      }
      else {
        input.select();
      }
    }
    return error;
  };

  const handleCameraCode = (raw: string): undefined | WarehouseScanErrorValue => handleScan(raw, true);

  const handleCameraPageHide = (): void => {
    setIsCameraOpen(false);
  };

  const handleOpenCamera = (): void => {
    console.log('> WarehouseScanInput -> handleOpenCamera:', {});
    if (document.hidden) {
      return;
    }
    setIsCameraOpen(true);
    load();
  };

  const handleCloseCamera = (): void => {
    console.log('> WarehouseScanInput -> handleCloseCamera:', {});
    setIsCameraOpen(false);
    requestAnimationFrame(() => cameraTriggerRef.current?.focus());
  };

  const handleApply = (): void => {
    scanner.reset();
    handleScan(inputRef.current?.value ?? '');
  };

  const handleInput = (event: SyntheticEvent<HTMLDivElement>): void => {
    if (event.target === inputRef.current) {
      const nativeEvent = event.nativeEvent;
      if (nativeEvent instanceof InputEvent && nativeEvent.inputType !== 'insertText') {
        scanner.reset();
      }
      setFeedback(undefined);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target === inputRef.current) {
      scanner.reset();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const input = inputRef.current;
    if (input === null || event.target !== input || event.defaultPrevented) {
      return;
    }
    const key = event.nativeEvent;
    const canStart = input.value === '' || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
    const scan = isReadOnly ? undefined : scanner.push(key, canStart);
    if (!key.isComposing && !key.altKey && !key.ctrlKey && !key.metaKey && key.key === WAREHOUSE_SCANNER_PROFILE.suffix) {
      event.preventDefault();
      if (!key.repeat) {
        handleScan(scan ?? input.value);
      }
    }
    else if (scanner.isGroupSeparator(key)) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isCameraLoading) {
      return undefined;
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        handleCameraPageHide();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleCameraPageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleCameraPageHide);
    };
  }, [isCameraLoading]);

  return (
    <div
      className="flex min-w-0 flex-col items-start gap-2"
      data-testid="warehouse-scan-input"
      onBlur={handleBlur}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full">
        <TextField
          autoComplete="off"
          enterKeyHint="done"
          error={hasError ? t(feedback) : undefined}
          hint={hasError ? undefined : t(feedback ?? 'warehouseWork.scanHint')}
          isReadOnly={isReadOnly}
          label={t('warehouseWork.scanCode')}
          messageLines={2}
          name="warehouse-scan-code"
          ref={inputRef}
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={isReadOnly} onClick={handleApply} variant="secondary">{t('warehouseWork.scanApply')}</Button>
        <Button
          aria-expanded={isCameraVisible}
          data-testid="warehouse-camera-open"
          disabled={isCameraTriggerDisabled}
          onClick={handleOpenCamera}
          pending={isCameraLoading}
          ref={cameraTriggerRef}
          variant="secondary"
        >
          {t('warehouseWork.cameraOpen')}
        </Button>
        {isCameraLoading && <Button onClick={handleCloseCamera} variant="secondary">{t('warehouseWork.cancel')}</Button>}
      </div>
      <span className="sr-only" role="status">{feedback === undefined ? '' : t(feedback)}</span>
      {isCameraActive && (
        <Camera onClose={handleCloseCamera} onCode={handleCameraCode} t={t} />
      )}
      {isCameraVisible && state.kind === 'failed' && (
        <ChunkLoadNotice
          message={t('warehouseWork.cameraFailed')}
          onRetry={load}
          recovery={state.recovery}
          repeatedMessage={t('warehouseWork.cameraFailed')}
        />
      )}
    </div>
  );
};
