import type { ReactElement } from 'react';

import type { PanelProps } from '@/shared/ui';

import { cn } from '@/shared/lib/cn';
import { Panel } from '@/shared/ui';

import type { HudZonePaddingValue } from './hudStyles';

import {
  HUD_ZONE_CLASS_NAME,
  HUD_ZONE_PADDING_CLASS_NAMES,
} from './hudStyles';

interface HudZoneProps extends Omit<PanelProps, 'as'> {
  label: string;
  padding?: HudZonePaddingValue | undefined;
  testId?: string | undefined;
}

export const HudZone = ({
  className,
  label,
  padding = 'zone',
  testId,
  ...rest
}: HudZoneProps): ReactElement => {
  return (
    <Panel
      {...rest}
      aria-label={label}
      as="section"
      className={cn(HUD_ZONE_CLASS_NAME, HUD_ZONE_PADDING_CLASS_NAMES[padding], className)}
      data-testid={testId}
    />
  );
};
