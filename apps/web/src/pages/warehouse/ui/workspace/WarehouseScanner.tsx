import type { ReactElement } from 'react';

import { useState } from 'react';

import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseScanErrorValue } from '../../model/scan/resolveReceivingScan';
import type { scanTools } from './WarehouseScanInput';

export type WarehouseScanHandlerValue = (raw: string, tools: typeof scanTools) => undefined | WarehouseScanErrorValue;

interface WarehouseScannerProps {
  isReadOnly: boolean;
  onScan: WarehouseScanHandlerValue;
  t: WarehouseWorkTranslate;
}

const loader = createCachedModuleLoader(() => import('./WarehouseScanInput'));

export const WarehouseScanner = ({ isReadOnly, onScan, t }: WarehouseScannerProps): ReactElement => {
  const { load, state } = useChunkLoader(loader);
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = (): void => {
    setIsOpen(true);
    load();
  };
  if (isOpen && state.kind === 'loaded') {
    const Scanner = state.module.WarehouseScanInput;
    return <Scanner isReadOnly={isReadOnly} onScan={onScan} t={t} />;
  }
  if (isOpen && state.kind === 'failed') {
    const message = t('warehouseWork.scanLoadError');
    return <ChunkLoadNotice message={message} onRetry={load} recovery={state.recovery} repeatedMessage={message} />;
  }
  return (
    <Button
      className="self-start"
      data-testid="warehouse-open-scanner"
      disabled={isReadOnly}
      onClick={handleOpen}
      pending={state.kind === 'loading'}
      variant="secondary"
    >
      {t('warehouseWork.scanOpen')}
    </Button>
  );
};
