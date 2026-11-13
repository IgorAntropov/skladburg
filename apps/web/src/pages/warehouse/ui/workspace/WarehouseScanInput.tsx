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
  Button,
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
import { resolveTaskReceivingScan } from '../../model/scan/resolveReceivingScan';

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
  const [scanner] = useState(() => createKeyboardScan(WAREHOUSE_SCANNER_PROFILE));
  const [feedback, setFeedback] = useState<'warehouseWork.scanMatched' | undefined | WarehouseScanErrorValue>();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasError = feedback !== undefined && feedback !== 'warehouseWork.scanMatched';

  const handleScan = (raw: string): void => {
    const input = inputRef.current;
    if (input === null || isReadOnly || raw.trim() === '') {
      return;
    }
    const error = onScan(raw, scanTools);
    input.focus();
    setFeedback(error ?? 'warehouseWork.scanMatched');
    if (error === undefined) {
      input.value = '';
    }
    else {
      input.select();
    }
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
      <Button disabled={isReadOnly} onClick={handleApply} variant="secondary">{t('warehouseWork.scanApply')}</Button>
      <span className="sr-only" role="status">{feedback === undefined ? '' : t(feedback)}</span>
    </div>
  );
};
