import {
  describe,
  expect,
  it,
} from 'vitest';

import { orderMiniMapCities } from './orderMiniMapCities';

describe('orderMiniMapCities', () => {
  it('orders the cities from the top row down and from left to right inside a row', () => {
    const ordered = orderMiniMapCities([
      { id: 'c', x: 0.2, y: 0.8 },
      { id: 'b', x: 0.9, y: 0.1 },
      { id: 'a', x: 0.3, y: 0.1 },
      { id: 'd', x: 0.5, y: 0.4 },
    ]);

    expect(ordered.map(city => city.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('breaks a tie of both coordinates by id', () => {
    const ordered = orderMiniMapCities([
      { id: 'b', x: 0.5, y: 0.5 },
      { id: 'a', x: 0.5, y: 0.5 },
    ]);

    expect(ordered.map(city => city.id)).toEqual(['a', 'b']);
  });

  it('does not change the input order', () => {
    const cities = [
      { id: 'b', x: 0.9, y: 0.1 },
      { id: 'a', x: 0.1, y: 0.1 },
    ];

    orderMiniMapCities(cities);

    expect(cities.map(city => city.id)).toEqual(['b', 'a']);
  });
});
