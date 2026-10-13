import type {
  ReactElement,
  Ref,
} from 'react';

import { cn } from '@/shared/lib/cn';

import { HUD_PASSTHROUGH_CLASS_NAME } from './hudStyles';

interface HudFreeAreaProps {
  className: string;
  ref: Ref<HTMLDivElement>;
}

export const HudFreeArea = ({ className, ref }: HudFreeAreaProps): ReactElement => {
  return (
    <div
      aria-hidden
      className={cn(HUD_PASSTHROUGH_CLASS_NAME, className)}
      data-testid="hud-free-area"
      ref={ref}
    />
  );
};
