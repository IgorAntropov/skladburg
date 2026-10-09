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
}

export const RouteFrame = ({ children, errorResetKey, path }: RouteFrameProps): ReactElement => {
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(path);
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
    if (previousPathRef.current === path) {
      return;
    }

    previousPathRef.current = path;
    mainRef.current?.focus();
  }, [path]);

  return (
    <main aria-busy={busyAttribute} className="flex flex-1 flex-col focus-visible:outline-none" ref={mainRef} tabIndex={-1}>
      <SectionErrorBoundary fallback={renderSectionError} key={errorResetKey} resetKey={path}>
        <Suspense fallback={sectionFallback}>{children}</Suspense>
      </SectionErrorBoundary>
    </main>
  );
};
