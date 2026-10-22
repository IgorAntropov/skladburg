import type { ReactElement } from 'react';

import { House } from 'lucide-react';

interface InspectorOwnBadgeProps {
  label: string;
}

const OWN_BADGE_CLASS_NAME = [
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-hover px-2.5 py-0.5',
  'text-sm leading-5 font-medium text-on-panel',
].join(' ');

export const InspectorOwnBadge = ({ label }: InspectorOwnBadgeProps): ReactElement => (
  <span className={OWN_BADGE_CLASS_NAME}>
    <House aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
    {label}
  </span>
);
