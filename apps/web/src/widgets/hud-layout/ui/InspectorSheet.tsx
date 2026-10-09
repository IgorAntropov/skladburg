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
  useRef,
  useState,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';

import { HUD_EDGE_SURFACE_CLASS_NAME } from './edgeSurfaceStyles';

interface InspectorSheetProps {
  children: ReactNode;
}

const SHEET_CLASS_NAME = cn(
  HUD_EDGE_SURFACE_CLASS_NAME,
  'sticky bottom-0 z-30 mt-auto flex max-h-[70dvh] flex-col rounded-t-panel border-t',
  'pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
  'motion-safe:transition-[translate,opacity] motion-safe:duration-(--duration-panel) motion-safe:ease-out',
  'motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0',
);

const TOGGLE_CLASS_NAME = 'relative m-1.5 shrink-0 aria-expanded:bg-transparent';

const HANDLE_CLASS_NAME = 'absolute top-1 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong';

const CONTENT_CLASS_NAME = 'flex min-h-0 flex-col overflow-y-auto px-4 pt-2 pb-4 @container';

export const InspectorSheet = ({ children }: InspectorSheetProps): ReactElement => {
  const { t } = useI18n();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleLabel = isExpanded ? t('hud.inspector.collapse') : t('hud.inspector.expand');
  const ToggleIcon = isExpanded ? ChevronDown : ChevronUp;

  const handleToggleClick = (): void => {
    console.log('> InspectorSheet -> handleToggleClick:', { isExpanded });
    setIsExpanded(current => !current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || !isExpanded) {
      return;
    }

    console.log('> InspectorSheet -> handleKeyDown:', { key: event.key });
    setIsExpanded(false);
    toggleRef.current?.focus();
  };

  return (
    <section
      aria-label={t('hud.inspector.title')}
      className={SHEET_CLASS_NAME}
      data-testid="hud-inspector-sheet"
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
      <div className={CONTENT_CLASS_NAME} hidden={!isExpanded} id={contentId}>
        {children}
      </div>
    </section>
  );
};
