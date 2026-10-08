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

import { PendingSignal } from './PendingSignal';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { SectionErrorScreen } from './SectionErrorScreen';

const renderSectionError = (error: Error, reset: () => void): ReactElement => (
  <SectionErrorScreen error={error} onReset={reset} />
);

interface RouteFrameProps {
  children: ReactNode;
  errorResetKey: string;
  path: string;
}

export const RouteFrame = ({ children, errorResetKey, path }: RouteFrameProps): ReactElement => {
  const mainRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(path);
  const [isPending, setIsPending] = useState(false);

  const busyAttribute = isPending ? true : undefined;

  useEffect(() => {
    if (previousPathRef.current === path) {
      return;
    }

    previousPathRef.current = path;
    mainRef.current?.focus();
  }, [path]);

  return (
    <main aria-busy={busyAttribute} className="flex-1 focus-visible:outline-none" ref={mainRef} tabIndex={-1}>
      <SectionErrorBoundary fallback={renderSectionError} key={errorResetKey} resetKey={path}>
        <Suspense fallback={<PendingSignal onPendingChange={setIsPending} />}>{children}</Suspense>
      </SectionErrorBoundary>
    </main>
  );
};
