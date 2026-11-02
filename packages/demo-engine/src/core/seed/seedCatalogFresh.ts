import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

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
  ['Яблоки Голден, 1 сорт', POME, 89],
  ['Яблоки Гала, 1 сорт', POME, 94],
  ['Яблоки Фуджи, 1 сорт', POME, 98],
  ['Яблоки Гренни Смит, 1 сорт', POME, 102],
  ['Яблоки Ренет Симиренко, 2 сорт', POME, 72],
  ['Яблоки Антоновка, 2 сорт', POME, 68],
  ['Груши Конференция, 1 сорт', POME, 128],
  ['Груши Вильямс, 1 сорт', POME, 136],
  ['Персики', STONE, 185],
  ['Нектарины', STONE, 195],
  ['Сливы', STONE, 120],
  ['Абрикосы', STONE, 160],
  ['Лимоны', CITRUS, 138],
  ['Апельсины', CITRUS, 96],
  ['Мандарины', CITRUS, 118],
  ['Грейпфруты', CITRUS, 112],
  ['Бананы', TROPICAL, 78],
  ['Виноград белый', GRAPE, 210],
  ['Виноград тёмный', GRAPE, 225],
  ['Картофель мытый', ROOT, 34],
  ['Морковь мытая', ROOT, 38],
  ['Свёкла столовая', ROOT, 32],
  ['Лук репчатый', ROOT, 29],
  ['Капуста белокочанная', CABBAGE, 26],
  ['Капуста краснокочанная', CABBAGE, 58],
  ['Томаты', FRUITING, 165],
  ['Огурцы гладкие', FRUITING, 145],
  ['Перец болгарский', FRUITING, 190],
  ['Баклажаны', FRUITING, 120],
  ['Кабачки', FRUITING, 70],
];

export const FRESH_GARDEN_ROWS: readonly SeedRowValue[] = [
  ['Томаты черри', FRUITING, 320],
  ['Огурцы короткоплодные', FRUITING, 160],
  ['Редис', GREENS, 140],
  ['Зелень укропа и петрушки', GREENS, 420],
  ['Салат листовой', GREENS, 380],
];

export const FRESH_DAIRY_ROWS: readonly SeedRowValue[] = [
  ['Молоко пастеризованное 3,2 %, пакет 1 л', MILK, 78],
  ['Молоко пастеризованное 2,5 %, пакет 1 л', MILK, 74],
  ['Молоко пастеризованное 1,5 %, пакет 1 л', MILK, 72],
  ['Молоко отборное 3,4 %, бутылка 0,9 л', MILK, 96],
  ['Молоко топлёное 4 %, бутылка 0,5 л', MILK, 64],
  ['Молоко ультрапастеризованное 3,2 %, пакет 1 л', UHT, 86],
  ['Молоко ультрапастеризованное 1,5 %, пакет 1 л', UHT, 82],
  ['Кефир 2,5 %, пакет 0,9 л', FERMENTED, 82],
  ['Кефир 1 %, пакет 0,9 л', FERMENTED, 79],
  ['Ряженка 4 %, пакет 0,5 л', FERMENTED, 58],
  ['Простокваша 3,2 %, бутылка 0,5 л', FERMENTED, 55],
  ['Йогурт питьевой натуральный, бутылка 0,5 л', FERMENTED, 68],
  ['Йогурт ложечный натуральный, стакан 125 г', CUPS_SMALL, 31],
  ['Йогурт ложечный с клубникой, стакан 125 г', CUPS_SMALL, 34],
  ['Сметана 15 %, стакан 400 г', CUPS_LARGE, 118],
  ['Сметана 20 %, стакан 400 г', CUPS_LARGE, 132],
  ['Сливки 10 %, пакет 0,5 л', FERMENTED, 96],
  ['Сливки 33 %, пакет 0,5 л', FERMENTED, 188],
  ['Творог 5 %, брикет 200 г', CUPS_SMALL, 74],
  ['Творог 9 %, на развес', COTTAGE, 395],
  ['Творог зернистый, стакан 200 г', CUPS_SMALL, 69],
  ['Масло сладкосливочное 82,5 %, брикет 180 г', BUTTER_BRICK, 196],
  ['Масло традиционное 72,5 %, на развес', BUTTER, 820],
  ['Сыр полутвёрдый 45 %, на развес', CHEESE, 640],
  ['Сыр российский 50 %, на развес', CHEESE, 690],
  ['Сыр плавленый, ванночка 200 г', CUPS_SMALL, 98],
  ['Сыр моцарелла 45 %, на развес', CHEESE, 710],
  ['Сыр брынза, на развес', CHEESE, 560],
  ['Молоко сухое цельное, мешок 25 кг', POWDER, 410],
  ['Мороженое пломбир 15 %, ванночка 400 г', ICE_CREAM, 112],
];

export const FRESH_POULTRY_ROWS: readonly SeedRowValue[] = [
  ['Утка тушка охлаждённая, 1 сорт', POULTRY_CHILLED, 335],
  ['Утка грудка без кожи охлаждённая', POULTRY_CHILLED, 690],
  ['Утка окорочка охлаждённые', POULTRY_CHILLED, 310],
  ['Утка печень замороженная', POULTRY_FROZEN, 280],
  ['Курица тушка охлаждённая, 1 сорт', POULTRY_CHILLED, 215],
  ['Куриное филе грудки охлаждённое', POULTRY_CHILLED, 395],
  ['Куриные бёдра охлаждённые', POULTRY_CHILLED, 205],
  ['Куриные голени охлаждённые', POULTRY_CHILLED, 190],
  ['Куриные крылья охлаждённые', POULTRY_CHILLED, 230],
  ['Куриные окорочка замороженные', POULTRY_FROZEN, 178],
  ['Куриное сердце замороженное', POULTRY_FROZEN, 215],
  ['Куриная печень охлаждённая', POULTRY_CHILLED, 205],
  ['Куриный фарш замороженный', POULTRY_FROZEN, 260],
  ['Индейка тушка охлаждённая', POULTRY_CHILLED, 340],
  ['Индейка филе грудки охлаждённое', POULTRY_CHILLED, 560],
  ['Индейка бедро охлаждённое', POULTRY_CHILLED, 410],
  ['Индейка фарш замороженный', POULTRY_FROZEN, 380],
  ['Гусь тушка охлаждённая', POULTRY_CHILLED, 620],
  ['Перепёлка тушка охлаждённая', POULTRY_CHILLED, 740],
  ['Свинина шея охлаждённая', MEAT_CHILLED, 520],
  ['Свинина лопатка охлаждённая', MEAT_CHILLED, 430],
  ['Свинина карбонад охлаждённый', MEAT_CHILLED, 560],
  ['Свинина рёбра охлаждённые', MEAT_CHILLED, 450],
  ['Фарш свиной замороженный', MEAT_FROZEN, 340],
  ['Говядина лопатка охлаждённая', MEAT_CHILLED, 640],
  ['Говядина вырезка охлаждённая', MEAT_CHILLED, 1290],
  ['Говядина тазобедренная часть охлаждённая', MEAT_CHILLED, 690],
  ['Фарш говяжий замороженный', MEAT_FROZEN, 520],
  ['Баранина лопатка охлаждённая', MEAT_CHILLED, 780],
  ['Печень говяжья замороженная', MEAT_FROZEN, 260],
];
