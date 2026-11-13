import {
  expect,
  it,
} from 'vitest';

import { readWarehouseQr } from './readWarehouseQr';

const BASE = new URL('https://example.test/skladburg/');
const ID = '00000000-0000-4000-8000-000000000001';

it.each([
  ['cells', 'cell'],
  ['handling-units', 'handling_unit'],
  ['deals', 'deal'],
])('reads a printed %s link, including a keyboard scanner AIM prefix', (segment, type) => {
  expect(readWarehouseQr(`]Q1${BASE.href}#/${segment}/${ID}`, BASE)).toEqual({
    kind: 'object',
    object: { id: ID, type },
  });
});

it.each([
  `https://foreign.test/skladburg/#/cells/${ID}`,
  `https://example.test/#/cells/${ID}`,
  `${BASE.href}#/listings/${ID}`,
  `${BASE.href}#/warehouse`,
  `#/cells/${ID}`,
  `${BASE.href}#/cells/${ID}?as=supplier`,
])('rejects an unsupported or noncanonical print link %s', (raw) => {
  expect(readWarehouseQr(raw, BASE)).toBeUndefined();
});
