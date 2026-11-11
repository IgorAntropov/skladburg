import type { ImportRow } from '@skladburg/contracts/import/v1/import';

import type { CommandAccessValue } from '@/shared/api';
import type { SectionTranslate } from '@/shared/i18n';

import type { importMessages } from '../i18n/ru';
import type { ImportTargetValue } from './importTarget';

export interface ImportOptionsValue {
  formatRow: (row: ImportRow) => string | undefined;
  getRuleMessage: (ruleId: string) => string | undefined;
  t: SectionTranslate<typeof importMessages>;
  target: ImportTargetValue;
  writeAccess: CommandAccessValue;
}
