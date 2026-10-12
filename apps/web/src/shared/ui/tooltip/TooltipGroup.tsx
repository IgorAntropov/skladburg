import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Provider } from '@radix-ui/react-tooltip';

import { TooltipGroupContext } from './TooltipGroupContext';
import {
  TOOLTIP_OPEN_DELAY_MS,
  TOOLTIP_SKIP_DELAY_MS,
} from './tooltipTiming';

export interface TooltipGroupProps {
  children: ReactNode;
}

export const TooltipGroup = ({ children }: TooltipGroupProps): ReactElement => {
  return (
    <Provider delayDuration={TOOLTIP_OPEN_DELAY_MS} skipDelayDuration={TOOLTIP_SKIP_DELAY_MS}>
      <TooltipGroupContext value>{children}</TooltipGroupContext>
    </Provider>
  );
};
