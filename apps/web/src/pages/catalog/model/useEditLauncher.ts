import type { RefCallback } from 'react';

import { useCallback } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { useFocusHandoff } from '@/shared/ui';

import type { ChunkLauncherValue } from '../lib/useChunkLauncher';

import { useChunkLauncher } from '../lib/useChunkLauncher';

export interface EditLauncherValue<TModule> extends ChunkLauncherValue<TModule> {
  buttonRef: RefCallback<HTMLButtonElement>;
}

export const useEditLauncher = <TModule>(
  loader: CachedModuleLoader<TModule>,
  focusKey: string,
): EditLauncherValue<TModule> => {
  const launcher = useChunkLauncher(loader);
  const { cancelFocus, ref: buttonRef, requestFocus } = useFocusHandoff<HTMLButtonElement>(focusKey);

  const { close: closeLauncher, open: openLauncher } = launcher;

  const open = useCallback((): void => {
    cancelFocus();
    openLauncher();
  }, [cancelFocus, openLauncher]);

  const close = useCallback((): void => {
    requestFocus();
    closeLauncher();
  }, [closeLauncher, requestFocus]);

  return { ...launcher, buttonRef, close, open };
};
