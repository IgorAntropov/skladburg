import type { ReactElement } from 'react';

import { FieldPage } from '@/pages/field';

import { useDocumentSync } from '../lib/useDocumentSync';

export const AppShell = (): ReactElement => {
  useDocumentSync();

  return <FieldPage />;
};
