import type { CatalogShapeValue } from '../localizer/messageShape';

export const catalog = {
  'app.startError.message': 'Не удалось запустить приложение',
  'app.startError.retry': 'Повторить',
  'app.startError.retrying': 'Повторяем…',
  'field.placeholder': 'Здесь скоро появится живой мир',
  'units.pallet': {
    few: '{count} паллеты',
    many: '{count} паллет',
    one: '{count} паллета',
    other: '{count} паллеты',
  },
} as const satisfies CatalogShapeValue;
