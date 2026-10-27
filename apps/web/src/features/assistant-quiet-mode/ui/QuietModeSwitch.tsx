import type { ReactElement } from 'react';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';

import { useAssistantQuietMode } from '../model/useAssistantQuietMode';

export interface QuietModeSwitchProps {
  hint?: string | undefined;
  label: string;
}

const TRACK_CLASS_NAME = 'relative h-6 w-10 shrink-0 rounded-full border border-line-strong bg-hover motion-safe:transition-colors';

const THUMB_CLASS_NAME = [
  'absolute top-[3px] left-[3px] size-4 rounded-full bg-on-panel-muted',
  'motion-safe:transition-[translate,background-color]',
].join(' ');

export const QuietModeSwitch = ({ hint, label }: QuietModeSwitchProps): ReactElement => {
  const { isQuiet, setQuiet } = useAssistantQuietMode();

  const handleSwitchClick = (): void => {
    console.log('> QuietModeSwitch -> handleSwitchClick:', { isQuiet: !isQuiet });
    setQuiet(!isQuiet);
  };

  return (
    <Button
      aria-checked={isQuiet}
      className="min-h-14 w-full justify-between gap-3 px-3 text-left"
      data-testid="assistant-quiet-mode-switch"
      onClick={handleSwitchClick}
      role="switch"
      variant="neutral"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-medium text-on-panel">{label}</span>
        {hint !== undefined && <span className="text-sm font-normal text-on-panel-muted">{hint}</span>}
      </span>
      <span aria-hidden className={cn(TRACK_CLASS_NAME, isQuiet && 'border-indicator bg-indicator')}>
        <span className={cn(THUMB_CLASS_NAME, isQuiet && 'translate-x-4 bg-panel-solid')} />
      </span>
    </Button>
  );
};
