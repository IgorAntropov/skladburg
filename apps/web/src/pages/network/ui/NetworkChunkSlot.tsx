import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import {
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import { useLoadedModule } from '../lib/useLoadedModule';
import { ChunkLoadNotice } from './ChunkLoadNotice';

interface NetworkChunkSlotProps<TModule> {
  children: (loadedModule: TModule) => ReactNode;
  isPending?: boolean | undefined;
  loader: CachedModuleLoader<TModule>;
  loadingLabel: string;
  skeleton: ReactNode;
}

export function NetworkChunkSlot<TModule>({
  children,
  isPending = false,
  loader,
  loadingLabel,
  skeleton,
}: NetworkChunkSlotProps<TModule>): ReactElement {
  const { isRetrying, retry, state } = useLoadedModule(loader);

  const isSkeletonActive = state.kind === 'loading' || (state.kind === 'loaded' && isPending);
  const isSkeletonFilled = useDelayedVisibility(isSkeletonActive);

  if (state.kind === 'failed') {
    return <ChunkLoadNotice isRetrying={isRetrying} onRetry={retry} recovery={state.recovery} />;
  }

  if (state.kind === 'loading' || isPending) {
    return <SkeletonGroup isFilled={isSkeletonFilled} label={loadingLabel}>{skeleton}</SkeletonGroup>;
  }

  return <>{children(state.module)}</>;
}
