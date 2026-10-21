import type { ReactElement } from 'react';

import { cn } from '@/shared/lib/cn';

import type { OrganizationSideValue } from '../config/sideBadges';
import type { SideShapeValue } from '../config/sideShapes';

import { SIDE_SHAPES } from '../config/sideShapes';

interface SideShapeProps {
  className?: string | undefined;
  side: OrganizationSideValue;
}

const RING_WIDTH = 0.09;

const VIEW_BOX_MARGIN = RING_WIDTH + 0.01;

const VIEW_BOX_SIZE = 1 + VIEW_BOX_MARGIN * 2;

const VIEW_BOX = [-VIEW_BOX_MARGIN, -VIEW_BOX_MARGIN, VIEW_BOX_SIZE, VIEW_BOX_SIZE].join(' ');

const SIDE_SHAPE_CLASS_NAMES = {
  carrier: 'fill-side-carrier stroke-on-side-carrier',
  customer: 'fill-side-customer stroke-on-side-customer',
  supplier: 'fill-side-supplier stroke-on-side-supplier',
} as const satisfies Record<OrganizationSideValue, string>;

const toSvgPoints = (shape: SideShapeValue): string => shape.outline.map(point => point.join(',')).join(' ');

const SIDE_SHAPE_POINTS = {
  carrier: toSvgPoints(SIDE_SHAPES.carrier),
  customer: toSvgPoints(SIDE_SHAPES.customer),
  supplier: toSvgPoints(SIDE_SHAPES.supplier),
} as const satisfies Record<OrganizationSideValue, string>;

export const SideShape = ({ className, side }: SideShapeProps): ReactElement => (
  <svg aria-hidden className={cn('size-4 shrink-0', className)} focusable="false" viewBox={VIEW_BOX}>
    <polygon
      className={SIDE_SHAPE_CLASS_NAMES[side]}
      paintOrder="stroke"
      points={SIDE_SHAPE_POINTS[side]}
      strokeLinejoin="round"
      strokeWidth={RING_WIDTH * 2}
    />
  </svg>
);
