import type { ReactElement } from 'react';

import type { PanelProps } from '@/shared/ui';

import { cn } from '@/shared/lib/cn';
import { Panel } from '@/shared/ui';

export type HudZonePaddingValue = 'edge' | 'flush-edge' | 'zone';

interface HudZoneProps extends Omit<PanelProps, 'as'> {
  label: string;
  padding?: HudZonePaddingValue | undefined;
  testId?: string | undefined;
}

const ZONE_CLASS_NAME = 'flex min-h-0 flex-col overflow-y-auto @container';

const ZONE_PADDING_CLASS_NAMES: Readonly<Record<HudZonePaddingValue, string>> = {
  'edge': 'px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
  'flush-edge': 'px-0 pt-0 pb-[env(safe-area-inset-bottom)]',
  'zone': 'p-4',
};

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
      className={cn(ZONE_CLASS_NAME, ZONE_PADDING_CLASS_NAMES[padding], className)}
      data-testid={testId}
    />
  );
};
