import type { AppAddressValue } from '@/shared/routing';

import { getAddressSection } from '@/shared/routing';

export const isLeavingCatalog = (next: AppAddressValue | undefined): boolean => {
  return next === undefined || getAddressSection(next) !== 'catalog';
};
