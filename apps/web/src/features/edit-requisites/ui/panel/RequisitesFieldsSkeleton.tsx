import type { ReactElement } from 'react';

import { Skeleton } from '@/shared/ui';

const PANEL_FIELD_IDS = [
  'legalAddress',
  'vatMode',
  'bik',
  'bankName',
  'settlementAccount',
  'correspondentAccount',
] as const;

export const RequisitesFieldsSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-4">
    {PANEL_FIELD_IDS.map(fieldId => <Skeleton className="h-14 w-full" key={fieldId} />)}
  </div>
);
