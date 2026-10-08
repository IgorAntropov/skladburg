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

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';

import {
  createCachedModuleLoader,
  toLazyModuleLoader,
} from '../lib/createCachedModuleLoader';
import { SectionErrorBoundary } from '../routing/SectionErrorBoundary';
import { loadPersonaSwitcher } from './loadPersonaSwitcher';
import { PersonaSwitcherFallback } from './PersonaSwitcherFallback';
import { PERSONA_SWITCHER_WIDTH_CLASS_NAME } from './personaSwitcherWidth';

const PERSONA_SWITCHER_BOUNDARY_KEY = 'persona-switcher';

const RETRY_BUTTON_CLASS_NAME = cn(PERSONA_SWITCHER_WIDTH_CLASS_NAME, 'justify-start');

const loadCachedPersonaSwitcher = toLazyModuleLoader(createCachedModuleLoader(loadPersonaSwitcher));

const createLazyPersonaSwitcher = (): LazyExoticComponent<ComponentType<PersonaSwitcherProps>> => lazy(loadCachedPersonaSwitcher);

export const PersonaSwitcherSlot = (): ReactElement => {
  const { t } = useI18n();

  const [LazyPersonaSwitcher, setLazyPersonaSwitcher] = useState(createLazyPersonaSwitcher);

  const renderLoadError = (error: Error, reset: () => void): ReactNode => {
    const handleRetryClick = (): void => {
      console.log('> PersonaSwitcherSlot -> handleRetryClick:', { error: error.name });
      setLazyPersonaSwitcher(createLazyPersonaSwitcher);
      reset();
    };

    return (
      <Button className={RETRY_BUTTON_CLASS_NAME} onClick={handleRetryClick} variant="secondary">
        {t('persona.loadError.retry')}
      </Button>
    );
  };

  return (
    <SectionErrorBoundary fallback={renderLoadError} resetKey={PERSONA_SWITCHER_BOUNDARY_KEY}>
      <Suspense fallback={<PersonaSwitcherFallback />}>
        <LazyPersonaSwitcher className={PERSONA_SWITCHER_WIDTH_CLASS_NAME} />
      </Suspense>
    </SectionErrorBoundary>
  );
};
