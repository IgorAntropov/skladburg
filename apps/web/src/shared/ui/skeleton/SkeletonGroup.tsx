import type {
  ReactElement,
  ReactNode,
} from 'react';

import { SkeletonFillContext } from './SkeletonFillContext';

interface SkeletonGroupProps {
  children: ReactNode;
  className?: string | undefined;
  isFilled: boolean;
  label: string;
}

export const SkeletonGroup = ({ children, className, isFilled, label }: SkeletonGroupProps): ReactElement => {
  return (
    <div aria-busy="true" aria-label={label} className={className} role="status">
      <SkeletonFillContext value={isFilled}>{children}</SkeletonFillContext>
    </div>
  );
};
