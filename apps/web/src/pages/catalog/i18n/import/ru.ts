import { importMessages } from '@/features/data-import';

export const catalog = {
  ...importMessages,
  'dataImport.rule.catalog.gtin_taken': 'Этот GTIN уже используется.',
  'dataImport.rule.catalog.min_order_not_multiple_of_step': 'Минимальный заказ должен быть кратен шагу заказа.',
  'dataImport.rule.catalog.min_price_above_tier': 'Минимальная цена выше цены за единицу.',
  'dataImport.rule.catalog.price_below_minimum': 'Цена за единицу ниже минимальной цены.',
  'dataImport.rule.catalog.sku_taken': 'Этот артикул уже используется.',
  'dataImport.rule.catalog.sphere_exists': 'Сфера с таким названием не найдена.',
  'dataImport.rule.catalog.temperature_range_order': 'Минимальная температура выше максимальной.',
  'dataImport.rule.field_check.gtin': 'Проверь контрольную цифру GTIN.',
  'dataImport.rule.import.columns': 'Количество ячеек не совпадает с заголовком.',
  'dataImport.rule.import.decimal': 'Укажи число с точностью до двух знаков после запятой.',
  'dataImport.rule.import.enum': 'Выбери значение из шаблона.',
  'dataImport.rule.import.identifier_taken': 'Не удалось выделить идентификатор. Проверь файл заново.',
  'dataImport.rule.import.integer': 'Укажи целое число в допустимом диапазоне.',
  'dataImport.rule.import.sphere_ambiguous': 'Уточни название сферы.',
  'dataImport.rule.import.temperature_pair': 'Укажи обе границы температуры.',
  'dataImport.rule.int64.gt': 'Укажи значение больше нуля.',
  'dataImport.rule.int64.gte': 'Укажи ноль или положительное значение.',
} as const;
