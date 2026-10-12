import type {
  ReactElement,
  ReactNode,
} from 'react';

import { cn } from '@/shared/lib/cn';

interface SceneLayerProps {
  children: ReactNode;
  className?: string | undefined;
}

export const SceneLayer = ({ children, className }: SceneLayerProps): ReactElement => {
  return <div className={cn('absolute inset-0', className)}>{children}</div>;
};
