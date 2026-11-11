import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { HudLayoutSkeleton } from '@/widgets/hud-layout';

import { PendingSignal } from './PendingSignal';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { SectionErrorScreen } from './SectionErrorScreen';
import { getPathSkeletonZones } from './sectionSkeletonZones';

const renderSectionError = (error: Error, reset: () => void): ReactElement => (
  <SectionErrorScreen error={error} onReset={reset} />
);

interface RouteFrameProps {
  children: ReactNode;
  errorResetKey: string;
  path: string;
  shouldPreserveScroll?: boolean | undefined;
}

export const RouteFrame = ({ children, errorResetKey, path, shouldPreserveScroll }: RouteFrameProps): ReactElement => {
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const previousRouteRef = useRef({ errorResetKey, path });
  const [isPending, setIsPending] = useState(false);

  const sectionLoadingLabel = t('routing.section.loading');
  const busyAttribute = isPending ? true : undefined;

  const sectionFallback = (
    <>
      <PendingSignal onPendingChange={setIsPending} />
      <HudLayoutSkeleton label={sectionLoadingLabel} zones={getPathSkeletonZones(path)} />
    </>
  );

  useEffect(() => {
    const prev = previousRouteRef.current;
    previousRouteRef.current = { errorResetKey, path };

    if (prev.path === path) {
      return;
    }

    mainRef.current?.focus({ preventScroll: shouldPreserveScroll === true && prev.errorResetKey === errorResetKey });
  }, [errorResetKey, path, shouldPreserveScroll]);

  return (
    <main aria-busy={busyAttribute} className="flex flex-1 flex-col focus-visible:outline-none" ref={mainRef} tabIndex={-1}>
      <SectionErrorBoundary fallback={renderSectionError} key={errorResetKey} resetKey={path}>
        <Suspense fallback={sectionFallback}>{children}</Suspense>
      </SectionErrorBoundary>
    </main>
  );
};
