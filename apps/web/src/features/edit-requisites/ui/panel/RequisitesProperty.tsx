import type {
  ReactElement,
  ReactNode,
} from 'react';

import { cn } from '@/shared/lib/cn';

const NUMERIC_CLASS_NAME = 'tabular-nums break-all';

export interface RequisitesPropertyProps {
  children: ReactNode;
  isNumeric?: boolean | undefined;
  label: string;
}

export const RequisitesProperty = ({ children, isNumeric = false, label }: RequisitesPropertyProps): ReactElement => (
  <div>
    <dt className="text-sm leading-5 text-on-panel-muted">{label}</dt>
    <dd className={cn('text-base leading-6 text-pretty wrap-break-word text-on-panel', isNumeric && NUMERIC_CLASS_NAME)}>
      {children}
    </dd>
  </div>
);
