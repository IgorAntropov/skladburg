import type {
  ReactElement,
  ReactNode,
} from 'react';

import { SkeletonGroup } from '../skeleton/SkeletonGroup';
import { useDelayedVisibility } from '../skeleton/useDelayedVisibility';
import { ErrorNotice } from './ErrorNotice';
import { useHeldError } from './useHeldError';

export interface WidgetStatesProps<TData> {
  children: (data: TData) => ReactNode;
  data: TData | undefined;
  empty?: ReactNode | undefined;
  error: Error | null;
  isEmpty?: ((data: TData) => boolean) | undefined;
  isRetrying?: boolean | undefined;
  loadingLabel: string;
  onRetry: (() => void) | undefined;
  skeleton: ReactNode;
}

export function WidgetStates<TData>({
  children,
  data,
  empty,
  error: currentError,
  isEmpty,
  isRetrying = false,
  loadingLabel,
  onRetry,
  skeleton,
}: WidgetStatesProps<TData>): ReactElement {
  const hasData = data !== undefined;
  const { announceKey, error } = useHeldError({ error: currentError, hasData, isRetrying });
  const isLoading = !hasData && error === null;

  const isSkeletonFilled = useDelayedVisibility(isLoading);

  const isSkeletonShown = isLoading || (hasData && isSkeletonFilled);

  if (isSkeletonShown) {
    return <SkeletonGroup isFilled={isSkeletonFilled} label={loadingLabel}>{skeleton}</SkeletonGroup>;
  }

  if (!hasData) {
    return <ErrorNotice announceKey={announceKey} error={error} isRetrying={isRetrying} onRetry={onRetry} />;
  }

  const isDataEmpty = isEmpty?.(data) === true;

  return <>{isDataEmpty ? empty : children(data)}</>;
}
