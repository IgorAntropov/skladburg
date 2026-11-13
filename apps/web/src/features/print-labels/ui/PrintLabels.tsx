import type { ReactElement } from 'react';

import {
  useRef,
  useState,
} from 'react';

import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import {
  Button,
  ChunkLoadNotice,
} from '@/shared/ui';

import type { PrintPageValue } from '../lib/printPageTypes';

interface PrintLabelsProps {
  getPages: () => Promise<readonly PrintPageValue[]> | readonly PrintPageValue[];
  label: string;
  testId?: string | undefined;
}

const loadPreview = createCachedModuleLoader(() => import('./PrintLabelsPreview'));

export const PrintLabels = ({ getPages, label, testId = 'print-labels-open' }: PrintLabelsProps): ReactElement => {
  const { load, state } = useChunkLoader(loadPreview);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = (): void => {
    setIsOpen(true);
    load();
  };

  const handleClose = (): void => {
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const Preview = state.kind === 'loaded' ? state.module.PrintLabelsPreview : undefined;

  return (
    <>
      <Button data-testid={testId} onClick={handleOpen} pending={state.kind === 'loading'} ref={triggerRef} variant="secondary">
        {label}
      </Button>
      {isOpen && Preview !== undefined && <Preview getPages={getPages} label={label} onClose={handleClose} />}
      {isOpen && state.kind === 'failed' && (
        <ChunkLoadNotice message={label} onRetry={load} recovery={state.recovery} repeatedMessage={label} />
      )}
    </>
  );
};
