import {
  describe,
  expect,
  it,
} from 'vitest';

import { DemoPersonaGroup } from '@/shared/api';

import { groupPersonas } from './groupPersonas';
import {
  CONSTRUCTION_BUYER_FIXTURE,
  CONSTRUCTION_SELLER_FIXTURE,
  FRESH_BUYER_FIXTURE,
  FRESH_CARRIER_FIXTURE,
  PERSONA_FIXTURES,
} from './testing/personaFixtures';

describe('groupPersonas', () => {
  it('returns nothing for an empty list', () => {
    expect(groupPersonas([])).toEqual([]);
  });

  it('keeps the groups in the order of their first appearance and the personas in the order of the list', () => {
    expect(groupPersonas(PERSONA_FIXTURES).map(({ group, personas }) => ({ group, ids: personas.map(persona => persona.id) }))).toEqual([
      {
        group: DemoPersonaGroup.FRESH,
        ids: PERSONA_FIXTURES.slice(0, 4).map(persona => persona.id),
      },
      {
        group: DemoPersonaGroup.CONSTRUCTION,
        ids: PERSONA_FIXTURES.slice(4).map(persona => persona.id),
      },
    ]);
  });

  it('follows the data when the groups come in another order and are interleaved', () => {
    const grouped = groupPersonas([
      CONSTRUCTION_BUYER_FIXTURE,
      FRESH_BUYER_FIXTURE,
      CONSTRUCTION_SELLER_FIXTURE,
      FRESH_CARRIER_FIXTURE,
    ]);

    expect(grouped.map(({ group }) => group)).toEqual([DemoPersonaGroup.CONSTRUCTION, DemoPersonaGroup.FRESH]);
    expect(grouped[0]?.personas).toEqual([CONSTRUCTION_BUYER_FIXTURE, CONSTRUCTION_SELLER_FIXTURE]);
    expect(grouped[1]?.personas).toEqual([FRESH_BUYER_FIXTURE, FRESH_CARRIER_FIXTURE]);
  });
});
