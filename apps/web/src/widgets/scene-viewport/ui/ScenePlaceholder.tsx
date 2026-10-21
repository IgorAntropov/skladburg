import type { LucideIcon } from 'lucide-react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  LayoutGrid,
  LoaderCircle,
} from 'lucide-react';

import { cn } from '@/shared/lib/cn';

interface ScenePlaceholderProps {
  action?: ReactNode | undefined;
  hint?: string | undefined;
  icon?: LucideIcon | undefined;
  isLoading?: boolean | undefined;
  label: string;
  role?: 'alert' | 'status' | undefined;
}

const ROOT_CLASS_NAME = 'relative flex size-full items-center justify-center overflow-hidden bg-canvas p-4';

const BOARD_CLASS_NAME = [
  'pointer-events-none absolute inset-0',
  '[mask-image:radial-gradient(ellipse_at_center,transparent_0,black_70%)]',
].join(' ');

const RISING_LINES_CLASS_NAME = [
  'absolute inset-0',
  'bg-[repeating-linear-gradient(60deg,transparent_0_95px,color-mix(in_srgb,var(--color-line)_55%,transparent)_96px,transparent_97px)]',
].join(' ');

const FALLING_LINES_CLASS_NAME = [
  'absolute inset-0',
  'bg-[repeating-linear-gradient(120deg,transparent_0_95px,color-mix(in_srgb,var(--color-line)_55%,transparent)_96px,transparent_97px)]',
].join(' ');

const CARD_CLASS_NAME = [
  'relative flex w-full max-w-sm flex-col items-center gap-3 rounded-panel border border-line bg-panel-solid p-5',
  'text-center text-on-panel shadow-panel',
  'motion-safe:transition-opacity motion-safe:duration-(--duration-fast) motion-safe:ease-out motion-safe:starting:opacity-0',
].join(' ');

const MESSAGE_CLASS_NAME = 'flex flex-col items-center gap-3';

const BADGE_CLASS_NAME = 'flex size-10 shrink-0 items-center justify-center rounded-full';

const NEUTRAL_BADGE_CLASS_NAME = 'bg-hover text-on-panel-muted';

const ALARM_BADGE_CLASS_NAME = 'bg-status-alarm text-on-status-alarm';

export const ScenePlaceholder = ({
  action,
  hint,
  icon,
  isLoading = false,
  label,
  role,
}: ScenePlaceholderProps): ReactElement => {
  const LabelIcon = isLoading ? LoaderCircle : (icon ?? LayoutGrid);
  const isDecorative = role === undefined;
  const isAlarm = role === 'alert';
  const badgeClassName = cn(BADGE_CLASS_NAME, isAlarm ? ALARM_BADGE_CLASS_NAME : NEUTRAL_BADGE_CLASS_NAME);
  const iconClassName = cn('size-5', isLoading && 'animate-spin motion-reduce:animate-none');

  return (
    <div aria-hidden={isDecorative || undefined} className={ROOT_CLASS_NAME}>
      <span className={BOARD_CLASS_NAME}>
        <span className={RISING_LINES_CLASS_NAME} />
        <span className={FALLING_LINES_CLASS_NAME} />
      </span>
      <div className={CARD_CLASS_NAME}>
        <div className={MESSAGE_CLASS_NAME} role={role}>
          <span aria-hidden className={badgeClassName}>
            <LabelIcon className={iconClassName} />
          </span>
          <p className="text-base leading-6 font-medium text-balance">{label}</p>
          {hint !== undefined && <p className="text-sm leading-5 text-balance text-on-panel-muted">{hint}</p>}
        </div>
        {action}
      </div>
    </div>
  );
};
