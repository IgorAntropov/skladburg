import type { DealLine } from '@skladburg/contracts/deal/v1/deal';

import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

const UNIT_LABELS = {
  [BaseUnit.GRAM]: 'dealInspector.unit.gram',
  [BaseUnit.MILLILITER]: 'dealInspector.unit.milliliter',
  [BaseUnit.PIECE]: 'dealInspector.unit.piece',
  [BaseUnit.UNSPECIFIED]: 'dealInspector.unit.unknown',
} as const;

export const dealLineUnit = (line: DealLine, t: DealInspectorTranslate): string =>
  t(UNIT_LABELS[line.productSnapshot?.baseUnit ?? BaseUnit.UNSPECIFIED]);

export const dealLinePriceBasis = (line: DealLine, format: Intl.NumberFormat, t: DealInspectorTranslate): string =>
  t('dealInspector.priceBasis', { quantity: format.format(line.priceUnitCoefficient), unit: dealLineUnit(line, t) });
