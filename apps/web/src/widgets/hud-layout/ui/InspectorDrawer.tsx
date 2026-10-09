import type {
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { HUD_EDGE_SURFACE_CLASS_NAME } from './hudStyles';

interface InspectorDrawerProps {
  children: ReactNode;
  onClose: () => void;
}

const DRAWER_CLASS_NAME = cn(
  HUD_EDGE_SURFACE_CLASS_NAME,
  'absolute inset-y-0 right-0 z-20 flex min-h-0 w-[min(24rem,90%)] flex-col overflow-y-auto @container',
  'rounded-l-panel border-l',
  'pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-4',
  'motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
  'motion-safe:starting:translate-x-full motion-safe:starting:opacity-0',
);

export const InspectorDrawer = ({ children, onClose }: InspectorDrawerProps): ReactElement => {
  const { t } = useI18n();

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    console.log('> InspectorDrawer -> handleKeyDown:', { key: event.key });
    onClose();
  };

  return (
    <section
      aria-label={t('hud.inspector.title')}
      className={DRAWER_CLASS_NAME}
      data-testid="hud-zone-inspector"
      onKeyDown={handleKeyDown}
    >
      {children}
    </section>
  );
};
