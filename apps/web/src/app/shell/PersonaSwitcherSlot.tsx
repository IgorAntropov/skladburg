import type {
  ComponentType,
  LazyExoticComponent,
  ReactElement,
  ReactNode,
} from 'react';

import {
  lazy,
  Suspense,
  useState,
} from 'react';

import type { PersonaSwitcherProps } from '@/features/switch-persona';

import {
  createCachedModuleLoader,
  toLazyModuleLoader,
} from '@/shared/lib/module-loader';

import { SectionErrorBoundary } from '../routing/SectionErrorBoundary';
import { loadPersonaSwitcher } from './loadPersonaSwitcher';
import { PersonaLoadRetry } from './PersonaLoadRetry';
import { PersonaSwitcherFallback } from './PersonaSwitcherFallback';
import { PERSONA_SWITCHER_FOCUS_KEY } from './personaSwitcherFocusKey';
import { PERSONA_SWITCHER_WIDTH_CLASS_NAME } from './personaSwitcherWidth';

const PERSONA_SWITCHER_BOUNDARY_KEY = 'persona-switcher';

const loadCachedPersonaSwitcher = toLazyModuleLoader(createCachedModuleLoader(loadPersonaSwitcher));

const createLazyPersonaSwitcher = (): LazyExoticComponent<ComponentType<PersonaSwitcherProps>> => lazy(loadCachedPersonaSwitcher);

export const PersonaSwitcherSlot = (): ReactElement => {
  const [LazyPersonaSwitcher, setLazyPersonaSwitcher] = useState(createLazyPersonaSwitcher);

  const renderLoadError = (error: Error, reset: () => void): ReactNode => {
    const handleRetry = (): void => {
      console.log('> PersonaSwitcherSlot -> handleRetry:', { error: error.name });
      setLazyPersonaSwitcher(createLazyPersonaSwitcher);
      reset();
    };

    return <PersonaLoadRetry onRetry={handleRetry} />;
  };

  return (
    <SectionErrorBoundary fallback={renderLoadError} resetKey={PERSONA_SWITCHER_BOUNDARY_KEY}>
      <Suspense fallback={<PersonaSwitcherFallback />}>
        <LazyPersonaSwitcher className={PERSONA_SWITCHER_WIDTH_CLASS_NAME} focusKey={PERSONA_SWITCHER_FOCUS_KEY} />
      </Suspense>
    </SectionErrorBoundary>
  );
};
