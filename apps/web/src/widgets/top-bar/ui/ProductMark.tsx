import type { ReactElement } from 'react';

const NODE_RADIUS = 2.75;
const HUB_RADIUS = 1.6;

export const ProductMark = (): ReactElement => (
  <svg
    aria-hidden
    className="size-6 shrink-0 text-indicator"
    data-testid="product-mark"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 24 24"
  >
    <path d="M12 5L5 18.25H19L12 5Z" />
    <circle cx="12" cy="5" fill="currentColor" r={NODE_RADIUS} />
    <circle cx="5" cy="18.25" fill="currentColor" r={NODE_RADIUS} />
    <circle cx="19" cy="18.25" fill="currentColor" r={NODE_RADIUS} />
    <circle className="text-accent" cx="12" cy="14.2" fill="currentColor" r={HUB_RADIUS} stroke="none" />
  </svg>
);
