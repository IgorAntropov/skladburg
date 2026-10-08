import type { ReactElement } from 'react';

import { use } from 'react';

import { cn } from '@/shared/lib/cn';

import type { SkeletonShapeValue } from './skeletonStyles';

import { SkeletonFillContext } from './SkeletonFillContext';
import {
  SKELETON_EMPTY_CLASS_NAME,
  SKELETON_FILLED_CLASS_NAME,
  SKELETON_SHAPE_RADIUS_CLASS_NAMES,
  SKELETON_SHAPE_SIZE_CLASS_NAMES,
} from './skeletonStyles';

interface SkeletonProps {
  className?: string | undefined;
  shape?: SkeletonShapeValue | undefined;
}

export const Skeleton = ({ className, shape = 'line' }: SkeletonProps): ReactElement => {
  const isFilled = use(SkeletonFillContext);

  return (
    <div
      aria-hidden
      className={cn(
        'shrink-0',
        SKELETON_SHAPE_RADIUS_CLASS_NAMES[shape],
        className ?? SKELETON_SHAPE_SIZE_CLASS_NAMES[shape],
        isFilled ? SKELETON_FILLED_CLASS_NAME : SKELETON_EMPTY_CLASS_NAME,
      )}
    />
  );
};
