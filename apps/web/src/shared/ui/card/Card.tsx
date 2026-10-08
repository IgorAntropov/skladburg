import type {
  HTMLAttributes,
  ReactElement,
} from 'react';

import { cn } from '@/shared/lib/cn';

const CARD_CLASS_NAME = 'flex flex-col gap-1 rounded-panel border border-line bg-panel-solid p-4 text-on-panel';

export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>): ReactElement => {
  return <div {...rest} className={cn(CARD_CLASS_NAME, className)} />;
};
