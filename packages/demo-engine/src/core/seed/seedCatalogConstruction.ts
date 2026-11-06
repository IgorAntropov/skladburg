import {
  AvailabilityStatus,
  BaseUnit,
} from '@skladburg/contracts/catalog/v1/catalog';

import type {
  SeedPackagingValue,
  SeedProfileValue,
  SeedRowValue,
} from './seedCatalog';

const TON_PRICE_UNIT = ['т', 1_000_000] as const;
const CUBIC_METER_PRICE_UNIT = ['м³', 1_000_000] as const;
const LITER_PRICE_UNIT = ['л', 1000] as const;
const PIECE_PRICE_UNIT = ['шт.', 1] as const;
const BAG_SHELF_LIFE_DAYS = 180;
const PALLET_TARE_GRAMS = 25_000;

const createTonProfile = (packaging: SeedPackagingValue): SeedProfileValue => ({
  baseUnit: BaseUnit.GRAM,
  minOrder: 2,
  packagings: [packaging],
  priceUnit: TON_PRICE_UNIT,
  shelfLifeDays: 0,
  step: 1,
});

const createBagProfile = (bagKilograms: number, bagsPerPallet: number, shelfLifeDays: number): SeedProfileValue => ({
  baseUnit: BaseUnit.PIECE,
  minOrder: bagsPerPallet,
  packagings: [[
    `Паллета ${String(bagsPerPallet)} мешков`,
    bagsPerPallet,
    bagKilograms * bagsPerPallet * 1000 + PALLET_TARE_GRAMS,
    1200,
    800,
    1300,
  ]],
  priceUnit: PIECE_PRICE_UNIT,
  shelfLifeDays,
  step: 1,
});

const createPieceProfile = (
  unitName: string,
  minOrder: number,
  step: number,
  packaging: SeedPackagingValue,
): SeedProfileValue => ({
  baseUnit: BaseUnit.PIECE,
  minOrder,
  packagings: [packaging],
  priceUnit: [unitName, 1],
  shelfLifeDays: 0,
  step,
});

const createVolumeProfile = (minOrder: number, step: number, packagings: readonly SeedPackagingValue[]): SeedProfileValue => ({
  baseUnit: BaseUnit.MILLILITER,
  minOrder,
  packagings,
  priceUnit: CUBIC_METER_PRICE_UNIT,
  shelfLifeDays: 0,
  step,
});

const REBAR = createTonProfile(['Пачка 1 т', 1_000_000, 1_005_000, 11_700, 500, 300]);
const PIPE = createTonProfile(['Пачка 2 т', 2_000_000, 2_012_000, 6000, 600, 450]);
const SHEET = createTonProfile(['Пачка 2 т', 2_000_000, 2_025_000, 2500, 1250, 250]);
const LONG = createTonProfile(['Пачка 2 т', 2_000_000, 2_010_000, 12_000, 500, 350]);
const WIRE = createPieceProfile('бухта', 50, 1, ['Паллета 50 бухт', 50, 1_035_000, 1200, 800, 700]);
const MESH = createPieceProfile('карта', 50, 10, ['Пачка 50 карт', 50, 190_000, 2000, 1000, 300]);
const ROOFING = createPieceProfile('лист', 100, 10, ['Пачка 50 листов', 50, 240_000, 2000, 1200, 250]);
const NAILS = createPieceProfile('ящик', 40, 1, ['Паллета 40 ящиков', 40, 1_050_000, 1200, 800, 900]);
const ELECTRODES = createPieceProfile('пач.', 80, 8, ['Коробка 8 пачек', 8, 41_000, 400, 300, 150]);

const CEMENT_BAG = createBagProfile(50, 28, 60);
const BAG_20 = createBagProfile(20, 60, BAG_SHELF_LIFE_DAYS);
const BAG_25 = createBagProfile(25, 48, BAG_SHELF_LIFE_DAYS);
const BAG_30 = createBagProfile(30, 40, BAG_SHELF_LIFE_DAYS);
const BAG_40 = createBagProfile(40, 35, BAG_SHELF_LIFE_DAYS);
const BIG_BAG: SeedProfileValue = {
  baseUnit: BaseUnit.GRAM,
  minOrder: 5,
  packagings: [['Биг-бэг 1 т', 1_000_000, 1_008_000, 1000, 1000, 1100]],
  priceUnit: TON_PRICE_UNIT,
  shelfLifeDays: 0,
  step: 1,
};
const CEMENT_BULK: SeedProfileValue = {
  ...BIG_BAG,
  packagings: [['Цементовоз 25 т', 25_000_000, 25_000_000, 8000, 2500, 3000]],
};
const LIQUID: SeedProfileValue = {
  baseUnit: BaseUnit.MILLILITER,
  minOrder: 480,
  packagings: [['Канистра 10 л', 10_000, 10_400, 200, 150, 300]],
  pallet: [48, 1200],
  priceUnit: LITER_PRICE_UNIT,
  shelfLifeDays: 365,
  step: 10,
  temperature: [5, 30],
};
const CONCRETE = createVolumeProfile(7, 1, [['Миксер 7 м³', 7_000_000, 17_500_000, 8000, 2500, 3500]]);
const BLOCK_D500 = createPieceProfile('шт.', 40, 1, ['Поддон 40 шт.', 40, 745_000, 1200, 800, 1300]);
const BLOCK_D600 = createPieceProfile('шт.', 32, 1, ['Поддон 32 шт.', 32, 889_000, 1200, 800, 1300]);
const FOUNDATION_BLOCK = createPieceProfile('шт.', 4, 1, ['Штука', 1, 1_300_000, 2380, 400, 580]);
const CONCRETE_RING = createPieceProfile('шт.', 4, 1, ['Штука', 1, 600_000, 1160, 1160, 890]);
const FLOOR_SLAB = createPieceProfile('шт.', 4, 1, ['Штука', 1, 2_800_000, 5980, 1490, 220]);
const PAVING = createPieceProfile('шт.', 360, 10, ['Поддон 360 шт.', 360, 1_020_000, 1200, 800, 700]);

const BOARDS = createVolumeProfile(6, 3, [['Пакет 3 м³', 3_000_000, 1_800_000, 6000, 1100, 500]]);
const PLANED = createVolumeProfile(3, 1, [['Пачка 1,5 м³', 1_500_000, 750_000, 3000, 1100, 600]]);
const PLYWOOD = createPieceProfile('шт.', 50, 5, ['Пачка 50 листов', 50, 905_000, 1525, 1525, 650]);
const STRAND_BOARD = createPieceProfile('шт.', 40, 4, ['Пачка 40 листов', 40, 700_000, 2500, 1250, 450]);
const SLATS = createPieceProfile('шт.', 200, 10, ['Пачка 100 шт.', 100, 150_000, 3000, 300, 300]);
const WOODEN_PALLET = createPieceProfile('шт.', 50, 10, ['Стопка 50 шт.', 50, 1_000_000, 1200, 800, 1500]);

export const CONSTRUCTION_METAL_ROWS: readonly SeedRowValue[] = [
  ['Арматура А500С, 12 мм', REBAR, 62_000, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Арматура А500С, 8 мм', REBAR, 65_500, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Арматура А500С, 10 мм', REBAR, 63_200, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Арматура А500С, 14 мм', REBAR, 61_800, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Арматура А500С, 16 мм', REBAR, 61_500, AvailabilityStatus.LOW, false, 100, 0],
  ['Арматура А500С, 20 мм', REBAR, 61_000, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Арматура гладкая А240, 12 мм', REBAR, 60_500, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Катанка 6,5 мм', REBAR, 58_900, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Труба профильная 40×40×3 мм', PIPE, 74_500, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Труба профильная 60×60×3 мм', PIPE, 73_800, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Труба профильная 100×50×4 мм', PIPE, 75_200, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Труба стальная круглая 57×3,5 мм', PIPE, 77_000, AvailabilityStatus.LOW, true, 0, 2],
  ['Труба водогазопроводная 32×3,2 мм', PIPE, 72_400, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Лист горячекатаный 3 мм', SHEET, 69_800, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Лист горячекатаный 5 мм', SHEET, 68_900, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Лист оцинкованный 0,7 мм', SHEET, 91_500, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Уголок равнополочный 50×50×5 мм', LONG, 66_400, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Уголок равнополочный 75×75×6 мм', LONG, 66_900, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Швеллер 10П', LONG, 67_800, AvailabilityStatus.LOW, false, 0, 4],
  ['Швеллер 16П', LONG, 68_300, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Балка двутавровая 20Б1', LONG, 71_500, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Балка двутавровая 30Б1', LONG, 72_100, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Полоса стальная 40×4 мм', LONG, 63_900, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Квадрат стальной 12 мм', LONG, 64_700, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Проволока вязальная 1,2 мм, бухта 20 кг', WIRE, 1850, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Сетка кладочная 50×50×3 мм, карта 0,5×2 м', MESH, 340, AvailabilityStatus.LOW, false, 90, 1],
  ['Профнастил С8 оцинкованный, лист 1,2×2 м', ROOFING, 780, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Профнастил НС35 оцинкованный, лист 1×2 м', ROOFING, 1050, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Электроды сварочные 3 мм, пачка 5 кг', ELECTRODES, 640, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Гвозди строительные 100 мм, ящик 25 кг', NAILS, 2350, AvailabilityStatus.IN_STOCK, false, 0, 0],
];

export const CONSTRUCTION_CEMENT_ROWS: readonly SeedRowValue[] = [
  ['Цемент М500, мешок 50 кг', CEMENT_BAG, 520, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Цемент М400, мешок 50 кг', CEMENT_BAG, 485, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Цемент М500, биг-бэг 1 т', BIG_BAG, 9800, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Цемент М500, навалом', CEMENT_BULK, 8900, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Смесь кладочная, мешок 25 кг', BAG_25, 245, AvailabilityStatus.LOW, false, 100, 0],
  ['Смесь штукатурная цементная, мешок 25 кг', BAG_25, 265, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Смесь штукатурная гипсовая, мешок 30 кг', BAG_30, 390, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Смесь для стяжки пола, мешок 40 кг', BAG_40, 310, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Смесь универсальная М150, мешок 40 кг', BAG_40, 335, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Клей плиточный, мешок 25 кг', BAG_25, 420, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Клей для газобетона, мешок 25 кг', BAG_25, 380, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Шпатлёвка финишная, мешок 20 кг', BAG_20, 560, AvailabilityStatus.LOW, true, 0, 2],
  ['Смесь наливной пол, мешок 25 кг', BAG_25, 640, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Пластификатор для бетона, канистра 10 л', LIQUID, 95, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Грунтовка глубокого проникновения, канистра 10 л', LIQUID, 72, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Песок строительный, биг-бэг 1 т', BIG_BAG, 850, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Щебень гранитный 5–20 мм, биг-бэг 1 т', BIG_BAG, 1850, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Щебень гранитный 20–40 мм, биг-бэг 1 т', BIG_BAG, 1750, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Смесь песчано-гравийная, биг-бэг 1 т', BIG_BAG, 780, AvailabilityStatus.LOW, false, 0, 4],
  ['Бетон В15 (М200)', CONCRETE, 4650, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Бетон В20 (М250)', CONCRETE, 4900, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Бетон В25 (М350)', CONCRETE, 5250, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Бетон В30 (М400)', CONCRETE, 5650, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Раствор кладочный М100', CONCRETE, 4300, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Блок газобетонный Д500, 600×300×200 мм', BLOCK_D500, 170, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Блок газобетонный Д600, 600×300×250 мм', BLOCK_D600, 235, AvailabilityStatus.LOW, false, 90, 1],
  ['Блок фундаментный ФБС 24-4-6', FOUNDATION_BLOCK, 5900, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Кольцо железобетонное КС 10-9', CONCRETE_RING, 3450, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Плита перекрытия многопустотная ПК 60.15', FLOOR_SLAB, 21_500, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Плитка тротуарная 200×100×60 мм', PAVING, 11, AvailabilityStatus.IN_STOCK, false, 0, 0],
];

export const CONSTRUCTION_TIMBER_ROWS: readonly SeedRowValue[] = [
  ['Доска обрезная 25×100×6000 мм, 1 сорт', BOARDS, 18_200, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Доска обрезная 25×150×6000 мм, 1 сорт', BOARDS, 18_400, AvailabilityStatus.IN_STOCK, false, 90, 2],
  ['Доска обрезная 40×100×6000 мм, 1 сорт', BOARDS, 18_600, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Доска обрезная 40×150×6000 мм, 1 сорт', BOARDS, 18_800, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Доска обрезная 50×100×6000 мм, 1 сорт', BOARDS, 19_000, AvailabilityStatus.LOW, false, 100, 0],
  ['Доска обрезная 50×150×6000 мм, 1 сорт', BOARDS, 19_200, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Доска обрезная 50×200×6000 мм, 1 сорт', BOARDS, 19_400, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Доска обрезная 50×150×6000 мм, 2 сорт', BOARDS, 15_800, AvailabilityStatus.ON_ORDER, true, 90, 3],
  ['Доска необрезная 25×6000 мм, 2 сорт', BOARDS, 11_900, AvailabilityStatus.IN_STOCK, false, 0, 4],
  ['Брус 100×100×6000 мм, 1 сорт', BOARDS, 19_800, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Брус 100×150×6000 мм, 1 сорт', BOARDS, 20_100, AvailabilityStatus.IN_STOCK, false, 100, 1],
  ['Брус 150×150×6000 мм, 1 сорт', BOARDS, 20_400, AvailabilityStatus.LOW, true, 0, 2],
  ['Брус 150×200×6000 мм, 1 сорт', BOARDS, 20_700, AvailabilityStatus.IN_STOCK, false, 0, 3],
  ['Брус 200×200×6000 мм, 1 сорт', BOARDS, 21_300, AvailabilityStatus.IN_STOCK, false, 90, 4],
  ['Брус сухой строганый 100×100×6000 мм', PLANED, 27_600, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Брус сухой строганый 150×150×6000 мм', PLANED, 28_300, AvailabilityStatus.IN_STOCK, true, 0, 1],
  ['Вагонка штиль 14×96×3000 мм', PLANED, 24_500, AvailabilityStatus.IN_STOCK, false, 100, 2],
  ['Имитация бруса 20×140×6000 мм', PLANED, 26_900, AvailabilityStatus.ON_ORDER, false, 0, 3],
  ['Блок-хаус 28×140×6000 мм', PLANED, 27_800, AvailabilityStatus.LOW, false, 0, 4],
  ['Доска пола шпунтованная 36×136×6000 мм', PLANED, 25_900, AvailabilityStatus.IN_STOCK, true, 90, 0],
  ['Фанера ФК 12 мм, 1525×1525 мм', PLYWOOD, 1180, AvailabilityStatus.IN_STOCK, false, 0, 1],
  ['Фанера ФК 18 мм, 1525×1525 мм', PLYWOOD, 1720, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Фанера ФСФ 18 мм, 1525×1525 мм', PLYWOOD, 1990, AvailabilityStatus.IN_STOCK, false, 100, 3],
  ['Плита ОСП-3 9 мм, 1250×2500 мм', STRAND_BOARD, 540, AvailabilityStatus.IN_STOCK, true, 0, 4],
  ['Плита ОСП-3 12 мм, 1250×2500 мм', STRAND_BOARD, 690, AvailabilityStatus.IN_STOCK, false, 0, 0],
  ['Плита ОСП-3 18 мм, 1250×2500 мм', STRAND_BOARD, 1010, AvailabilityStatus.LOW, false, 90, 1],
  ['Рейка 20×40×3000 мм', SLATS, 62, AvailabilityStatus.IN_STOCK, false, 0, 2],
  ['Брусок 40×40×3000 мм', SLATS, 118, AvailabilityStatus.ON_ORDER, true, 0, 3],
  ['Брусок 50×50×3000 мм', SLATS, 172, AvailabilityStatus.IN_STOCK, false, 100, 4],
  ['Поддон деревянный 1200×800 мм', WOODEN_PALLET, 520, AvailabilityStatus.IN_STOCK, false, 0, 0],
];
