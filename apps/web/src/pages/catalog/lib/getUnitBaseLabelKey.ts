import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

import type { CatalogEditorMessageKeyValue } from '../i18n/editor/editorSection';

type UnitBaseLabelKeyValue = Extract<CatalogEditorMessageKeyValue, `catalogEditor.unit.base.${string}`>;

const UNIT_BASE_LABEL_KEYS: Readonly<Partial<Record<BaseUnit, UnitBaseLabelKeyValue>>> = {
  [BaseUnit.GRAM]: 'catalogEditor.unit.base.gram',
  [BaseUnit.MILLILITER]: 'catalogEditor.unit.base.milliliter',
  [BaseUnit.PIECE]: 'catalogEditor.unit.base.piece',
};

export const getUnitBaseLabelKey = (baseUnit: BaseUnit): UnitBaseLabelKeyValue => (
  UNIT_BASE_LABEL_KEYS[baseUnit] ?? 'catalogEditor.unit.base.piece'
);
