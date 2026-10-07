import { create } from '@bufbuild/protobuf';
import {
  type Sphere,
  SphereSchema,
} from '@skladburg/contracts/organization/v1/organization';

import { SeedSphereId } from './seedIds';

interface SeedSphereDefinitionValue {
  id: string;
  name: string;
  parentId: string;
}

const SEED_SPHERE_DEFINITIONS: readonly SeedSphereDefinitionValue[] = [
  { id: SeedSphereId.FOOD, name: 'Продукты', parentId: '' },
  { id: SeedSphereId.DAIRY, name: 'Молочная продукция', parentId: SeedSphereId.FOOD },
  { id: SeedSphereId.FRUIT_AND_VEGETABLES, name: 'Овощи и фрукты', parentId: SeedSphereId.FOOD },
  { id: SeedSphereId.MEAT_AND_POULTRY, name: 'Мясо и птица', parentId: SeedSphereId.FOOD },
  { id: SeedSphereId.CONSTRUCTION, name: 'Стройматериалы', parentId: '' },
  { id: SeedSphereId.METAL_PRODUCTS, name: 'Металлопрокат', parentId: SeedSphereId.CONSTRUCTION },
  { id: SeedSphereId.CEMENT_AND_CONCRETE, name: 'Цемент и бетон', parentId: SeedSphereId.CONSTRUCTION },
  { id: SeedSphereId.TIMBER, name: 'Пиломатериалы', parentId: SeedSphereId.CONSTRUCTION },
];

export const createSeedSpheres = (): Sphere[] => SEED_SPHERE_DEFINITIONS.map(definition => create(SphereSchema, definition));
