import type {
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react';

import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';

import { HUD_EDGE_SURFACE_CLASS_NAME } from './edgeSurfaceStyles';
import { HUD_PHONE_RISE_CLASS_NAME } from './hudStyles';

interface InspectorSheetProps {
  children: ReactNode;
  collapseSignal: number;
  isCollapseRequested: boolean;
}

const SHEET_CLASS_NAME = cn(
  HUD_EDGE_SURFACE_CLASS_NAME,
  'sticky bottom-0 z-30 mt-auto flex max-h-[70dvh] flex-col rounded-t-panel border-t',
  'pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
  HUD_PHONE_RISE_CLASS_NAME,
);

const TOGGLE_CLASS_NAME = 'relative m-1.5 shrink-0 aria-expanded:bg-transparent';

const HANDLE_CLASS_NAME = 'absolute top-1 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong';

const CONTENT_CLASS_NAME = 'flex min-h-0 flex-col overflow-y-auto px-4 pt-2 pb-4 @container';

export const InspectorSheet = ({ children, collapseSignal, isCollapseRequested }: InspectorSheetProps): ReactElement => {
  const { t } = useI18n();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handledCollapseSignalRef = useRef(collapseSignal);
  const contentId = useId();
  const [expandedSignal, setExpandedSignal] = useState<null | number>(isCollapseRequested ? null : collapseSignal);
  const isExpanded = expandedSignal === collapseSignal;

  const toggleLabel = isExpanded ? t('hud.inspector.collapse') : t('hud.inspector.expand');
  const ToggleIcon = isExpanded ? ChevronDown : ChevronUp;

  const handleToggleClick = (): void => {
    console.log('> InspectorSheet -> handleToggleClick:', { isExpanded });
    setExpandedSignal(isExpanded ? null : collapseSignal);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || !isExpanded) {
      return;
    }

    console.log('> InspectorSheet -> handleKeyDown:', { key: event.key });
    setExpandedSignal(null);
    toggleRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (handledCollapseSignalRef.current === collapseSignal) {
      return;
    }

    handledCollapseSignalRef.current = collapseSignal;

    const { activeElement } = document;

    if (activeElement === null || activeElement === document.body || contentRef.current?.contains(activeElement)) {
      toggleRef.current?.focus();
    }
  }, [collapseSignal]);

  return (
    <section
      aria-label={t('hud.inspector.title')}
      className={SHEET_CLASS_NAME}
      onKeyDown={handleKeyDown}
    >
      <Button
        aria-controls={contentId}
        aria-expanded={isExpanded}
        className={TOGGLE_CLASS_NAME}
        onClick={handleToggleClick}
        ref={toggleRef}
        variant="ghost"
      >
        <span aria-hidden className={HANDLE_CLASS_NAME} />
        {toggleLabel}
        <ToggleIcon aria-hidden className="size-5" />
      </Button>
      <div className={CONTENT_CLASS_NAME} hidden={!isExpanded} id={contentId} ref={contentRef}>
        {children}
      </div>
    </section>
  );
};
