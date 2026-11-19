import {
  expect,
  it,
} from 'vitest';

import { isWarehouseYardDockChoiceAllowed } from './warehouseYardDockChoice';

it('only accepts a dock choice covered by the latest visit version and server options', () => {
  const choice = { taskId: 'visit-1', taskVersion: 2, unloadingPointId: 'dock-6' };
  const options = new Map([['visit-1', { taskVersion: 2, unloadingPointIds: ['dock-1', 'dock-6'] }]]);

  expect(isWarehouseYardDockChoiceAllowed(options, choice)).toBe(true);
  expect(isWarehouseYardDockChoiceAllowed(options, { ...choice, taskVersion: 1 })).toBe(false);
  expect(isWarehouseYardDockChoiceAllowed(options, { ...choice, unloadingPointId: 'dock-3' })).toBe(false);
  expect(isWarehouseYardDockChoiceAllowed(options, { ...choice, taskId: 'visit-2' })).toBe(false);
  expect(isWarehouseYardDockChoiceAllowed(undefined, choice)).toBe(false);
});
