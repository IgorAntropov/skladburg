import type {
  HTMLAttributes,
  ReactElement,
} from 'react';

import { cn } from '@/shared/lib/cn';

export type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'aside' | 'div' | 'header' | 'section' | undefined;
};

const PANEL_CLASS_NAME = 'rounded-panel border border-line bg-panel text-on-panel shadow-panel backdrop-blur-panel';

export const Panel = ({ as: Tag = 'div', className, ...rest }: PanelProps): ReactElement => {
  return <Tag {...rest} className={cn(PANEL_CLASS_NAME, className)} />;
};
