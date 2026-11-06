import {
  AvailabilityStatus,
  BaseUnit,
} from '@skladburg/contracts/catalog/v1/catalog';

import type {
  SeedPackagingValue,
  SeedProfileValue,
  SeedRowValue,
} from './seedCatalog';

const WEIGHT_PRICE_UNIT = ['кг', 1000] as const;
const PIECE_PRICE_UNIT = ['шт.', 1] as const;

const CRATE_12_KG: SeedPackagingValue = ['Ящик 12 кг', 12_000, 12_700, 400, 300, 220];
const CRATE_6_KG: SeedPackagingValue = ['Ящик 6 кг', 6000, 6500, 400, 300, 120];
const BAG_25_KG: SeedPackagingValue = ['Мешок 25 кг', 25_000, 25_150, 600, 400, 150];
const CRATE_12_BOTTLES: SeedPackagingValue = ['Ящик 12 шт.', 12, 13_400, 400, 300, 230];

const POME: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 480,
  packagings: [CRATE_12_KG],
  pallet: [40, 1700],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 90,
  step: 480,
  temperature: [0, 4],
};

const STONE: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 360,
  packagings: [CRATE_6_KG],
  pallet: [60, 1400],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 10,
  step: 6,
  temperature: [0, 4],
};

const CITRUS: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 600,
  packagings: [['Ящик 15 кг', 15_000, 15_900, 400, 300, 250]],
  pallet: [40, 1650],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 30,
  step: 15,
  temperature: [4, 8],
};

const TROPICAL: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 900,
  packagings: [['Коробка 18 кг', 18_000, 19_000, 500, 400, 250]],
  pallet: [50, 1700],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 10,
  step: 18,
  temperature: [13, 15],
};

const GRAPE: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 400,
  packagings: [['Лоток 5 кг', 5000, 5400, 400, 300, 110]],
  pallet: [80, 1500],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 14,
  step: 5,
  temperature: [0, 2],
};

const ROOT: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 1000,
  packagings: [BAG_25_KG],
  pallet: [40, 1300],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 120,
  step: 25,
  temperature: [2, 6],
};

const CABBAGE: SeedProfileValue = { ...ROOT, shelfLifeDays: 60, temperature: [0, 4] };

const FRUITING: SeedProfileValue = { ...STONE, shelfLifeDays: 14, temperature: [8, 12] };

const GREENS: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 180,
  packagings: [['Ящик 3 кг', 3000, 3300, 400, 300, 150]],
  pallet: [60, 1400],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 5,
  step: 3,
  temperature: [1, 4],
};

const MILK: SeedProfileValue = {
  baseUnit: BaseUnit.PIECE,
  minOrder: 360,
  packagings: [CRATE_12_BOTTLES],
  pallet: [30, 1300],
  priceUnit: PIECE_PRICE_UNIT,
  shelfLifeDays: 10,
  step: 12,
  temperature: [2, 6],
};

const UHT: SeedProfileValue = {
  ...MILK,
  minOrder: 540,
  packagings: [['Блок 12 шт.', 12, 12_900, 300, 200, 270]],
  pallet: [45, 1500],
  shelfLifeDays: 180,
  temperature: [4, 25],
};

const FERMENTED: SeedProfileValue = { ...MILK, shelfLifeDays: 14 };

const CUPS_SMALL: SeedProfileValue = {
  ...MILK,
  minOrder: 960,
  packagings: [['Короб 24 шт.', 24, 4100, 400, 300, 120]],
  pallet: [40, 1200],
  shelfLifeDays: 21,
  step: 24,
};

const CUPS_LARGE: SeedProfileValue = {
  ...CUPS_SMALL,
  minOrder: 480,
  packagings: [['Короб 12 шт.', 12, 5400, 400, 300, 130]],
  step: 12,
};

const COTTAGE: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 100,
  packagings: [['Ведро 5 кг', 5000, 5400, 300, 300, 250]],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 14,
  step: 5,
  temperature: [2, 6],
};

const CHEESE: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 200,
  packagings: [['Короб 10 кг', 10_000, 10_600, 400, 300, 200]],
  pallet: [40, 1200],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 90,
  step: 10,
  temperature: [2, 8],
};

const BUTTER: SeedProfileValue = {
  ...COTTAGE,
  minOrder: 200,
  packagings: [['Короб 20 кг', 20_000, 20_800, 400, 300, 200]],
  shelfLifeDays: 120,
  step: 20,
  temperature: [0, 6],
};

const BUTTER_BRICK: SeedProfileValue = {
  ...MILK,
  minOrder: 400,
  packagings: [['Короб 40 шт.', 40, 7900, 400, 300, 150]],
  pallet: undefined,
  shelfLifeDays: 120,
  step: 40,
  temperature: [0, 6],
};

const POWDER: SeedProfileValue = { ...ROOT, shelfLifeDays: 360, temperature: [0, 25] };

const ICE_CREAM: SeedProfileValue = {
  ...BUTTER_BRICK,
  minOrder: 240,
  packagings: [['Короб 12 шт.', 12, 5700, 400, 300, 200]],
  shelfLifeDays: 365,
  step: 12,
  temperature: [-25, -18],
};

const POULTRY_CHILLED: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 200,
  packagings: [['Ящик 10 кг', 10_000, 10_900, 600, 400, 150]],
  pallet: [40, 1300],
  priceUnit: WEIGHT_PRICE_UNIT,
  shelfLifeDays: 6,
  step: 10,
  temperature: [-2, 2],
};

const POULTRY_FROZEN: SeedProfileValue = {
  ...POULTRY_CHILLED,
  minOrder: 300,
  packagings: [['Короб 15 кг', 15_000, 15_700, 500, 300, 200]],
  shelfLifeDays: 270,
  step: 15,
  temperature: [-25, -18],
};

const MEAT_CHILLED: SeedProfileValue = { ...POULTRY_CHILLED, shelfLifeDays: 12, temperature: [-1, 3] };

const MEAT_FROZEN: SeedProfileValue = { ...POULTRY_FROZEN, shelfLifeDays: 180 };

export const FRESH_FRUIT_ROWS: readonly SeedRowValue[] = [
  ['Яблоки Голден, 1 сорт', POME, 89, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Яблоки Гала, 1 сорт', POME, 94, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Яблоки Фуджи, 1 сорт', POME, 98, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Яблоки Гренни Смит, 1 сорт', POME, 102, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Яблоки Ренет Симиренко, 2 сорт', POME, 72, AvailabilityStatus.LOW, false, 100, 0],
  ['Яблоки Антоновка, 2 сорт', POME, 68, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Груши Конференция, 1 сорт', POME, 128, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Груши Вильямс, 1 сорт', POME, 136, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Персики', STONE, 185, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Нектарины', STONE, 195, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Сливы', STONE, 120, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Абрикосы', STONE, 160, AvailabilityStatus.LOW, true, 0, 2],
  ['Лимоны', CITRUS, 138, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Апельсины', CITRUS, 96, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Мандарины', CITRUS, 118, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Грейпфруты', CITRUS, 112, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Бананы', TROPICAL, 78, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Виноград белый', GRAPE, 210, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Виноград тёмный', GRAPE, 225, AvailabilityStatus.LOW, false, 0, 4],
  ['Картофель мытый', ROOT, 34, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Морковь мытая', ROOT, 38, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Свёкла столовая', ROOT, 32, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Лук репчатый', ROOT, 29, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Капуста белокочанная', CABBAGE, 26, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Капуста краснокочанная', CABBAGE, 58, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Томаты', FRUITING, 165, AvailabilityStatus.LOW, false, 90, 1],
  ['Огурцы гладкие', FRUITING, 145, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Перец болгарский', FRUITING, 190, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Баклажаны', FRUITING, 120, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Кабачки', FRUITING, 70, AvailabilityStatus.IN_STOCK, false, 0, 0],
];

export const FRESH_GARDEN_ROWS: readonly SeedRowValue[] = [
  ['Томаты черри', FRUITING, 320, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Огурцы короткоплодные', FRUITING, 160, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Редис', GREENS, 140, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Зелень укропа и петрушки', GREENS, 420, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Салат листовой', GREENS, 380, AvailabilityStatus.LOW, false, 100, 0],
];

export const FRESH_DAIRY_ROWS: readonly SeedRowValue[] = [
  ['Молоко пастеризованное 3,2 %, пакет 1 л', MILK, 78, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Молоко пастеризованное 2,5 %, пакет 1 л', MILK, 74, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Молоко пастеризованное 1,5 %, пакет 1 л', MILK, 72, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Молоко отборное 3,4 %, бутылка 0,9 л', MILK, 96, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Молоко топлёное 4 %, бутылка 0,5 л', MILK, 64, AvailabilityStatus.LOW, false, 100, 0],
  ['Молоко ультрапастеризованное 3,2 %, пакет 1 л', UHT, 86, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Молоко ультрапастеризованное 1,5 %, пакет 1 л', UHT, 82, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Кефир 2,5 %, пакет 0,9 л', FERMENTED, 82, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Кефир 1 %, пакет 0,9 л', FERMENTED, 79, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Ряженка 4 %, пакет 0,5 л', FERMENTED, 58, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Простокваша 3,2 %, бутылка 0,5 л', FERMENTED, 55, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Йогурт питьевой натуральный, бутылка 0,5 л', FERMENTED, 68, AvailabilityStatus.LOW, true, 0, 2],
  ['Йогурт ложечный натуральный, стакан 125 г', CUPS_SMALL, 31, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Йогурт ложечный с клубникой, стакан 125 г', CUPS_SMALL, 34, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Сметана 15 %, стакан 400 г', CUPS_LARGE, 118, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Сметана 20 %, стакан 400 г', CUPS_LARGE, 132, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Сливки 10 %, пакет 0,5 л', FERMENTED, 96, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Сливки 33 %, пакет 0,5 л', FERMENTED, 188, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Творог 5 %, брикет 200 г', CUPS_SMALL, 74, AvailabilityStatus.LOW, false, 0, 4],
  ['Творог 9 %, на развес', COTTAGE, 395, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Творог зернистый, стакан 200 г', CUPS_SMALL, 69, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Масло сладкосливочное 82,5 %, брикет 180 г', BUTTER_BRICK, 196, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Масло традиционное 72,5 %, на развес', BUTTER, 820, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Сыр полутвёрдый 45 %, на развес', CHEESE, 640, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Сыр российский 50 %, на развес', CHEESE, 690, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Сыр плавленый, ванночка 200 г', CUPS_SMALL, 98, AvailabilityStatus.LOW, false, 90, 1],
  ['Сыр моцарелла 45 %, на развес', CHEESE, 710, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Сыр брынза, на развес', CHEESE, 560, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Молоко сухое цельное, мешок 25 кг', POWDER, 410, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Мороженое пломбир 15 %, ванночка 400 г', ICE_CREAM, 112, AvailabilityStatus.IN_STOCK, false, 0, 0],
];

export const FRESH_POULTRY_ROWS: readonly SeedRowValue[] = [
  ['Утка тушка охлаждённая, 1 сорт', POULTRY_CHILLED, 335, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Утка грудка без кожи охлаждённая', POULTRY_CHILLED, 690, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Утка окорочка охлаждённые', POULTRY_CHILLED, 310, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Утка печень замороженная', POULTRY_FROZEN, 280, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Курица тушка охлаждённая, 1 сорт', POULTRY_CHILLED, 215, AvailabilityStatus.LOW, false, 100, 0],
  ['Куриное филе грудки охлаждённое', POULTRY_CHILLED, 395, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Куриные бёдра охлаждённые', POULTRY_CHILLED, 205, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Куриные голени охлаждённые', POULTRY_CHILLED, 190, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Куриные крылья охлаждённые', POULTRY_CHILLED, 230, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Куриные окорочка замороженные', POULTRY_FROZEN, 178, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Куриное сердце замороженное', POULTRY_FROZEN, 215, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Куриная печень охлаждённая', POULTRY_CHILLED, 205, AvailabilityStatus.LOW, true, 0, 2],
  ['Куриный фарш замороженный', POULTRY_FROZEN, 260, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Индейка тушка охлаждённая', POULTRY_CHILLED, 340, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Индейка филе грудки охлаждённое', POULTRY_CHILLED, 560, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Индейка бедро охлаждённое', POULTRY_CHILLED, 410, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Индейка фарш замороженный', POULTRY_FROZEN, 380, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Гусь тушка охлаждённая', POULTRY_CHILLED, 620, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Перепёлка тушка охлаждённая', POULTRY_CHILLED, 740, AvailabilityStatus.LOW, false, 0, 4],
  ['Свинина шея охлаждённая', MEAT_CHILLED, 520, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Свинина лопатка охлаждённая', MEAT_CHILLED, 430, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Свинина карбонад охлаждённый', MEAT_CHILLED, 560, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Свинина рёбра охлаждённые', MEAT_CHILLED, 450, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Фарш свиной замороженный', MEAT_FROZEN, 340, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Говядина лопатка охлаждённая', MEAT_CHILLED, 640, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Говядина вырезка охлаждённая', MEAT_CHILLED, 1290, AvailabilityStatus.LOW, false, 90, 1],
  ['Говядина тазобедренная часть охлаждённая', MEAT_CHILLED, 690, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Фарш говяжий замороженный', MEAT_FROZEN, 520, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Баранина лопатка охлаждённая', MEAT_CHILLED, 780, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Печень говяжья замороженная', MEAT_FROZEN, 260, AvailabilityStatus.IN_STOCK, false, 0, 0],
];
