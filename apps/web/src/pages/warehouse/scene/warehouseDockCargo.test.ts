import { create } from '@bufbuild/protobuf';
import { StockBalanceSchema } from '@skladburg/contracts/wms/v1/stock';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from '../model/warehouseSceneCargo';

import { splitWarehouseDockCargo } from './warehouseDockCargo';

const makeUnit = (
  taskId: string,
  unloadingPointId: string | undefined,
  location: WarehouseCargoUnitValue['location'] = 'truck',
): WarehouseCargoUnitValue => ({
  cellId: undefined, expectedUnitId: taskId, id: taskId, location, slot: 0, taskId, truckSlot: 0, unloadingPointId,
});

describe('warehouse dock cargo assignments', () => {
  it('keeps a promotion waiting while its assigned dock is absent from the displayed layout', () => {
    const promotion = { taskId: 'waiting', tripId: 'waiting-trip', unloadingPointId: 'D02' };
    const cargo: WarehouseCargoValue = {
      dockTaskId: promotion.taskId, dockVisits: [promotion], hasDock: true, units: [],
    };

    const [oldPrimary] = splitWarehouseDockCargo(cargo, undefined, ['D01']);
    const [, newDock] = splitWarehouseDockCargo(cargo, undefined, ['D01', 'D02']);

    expect(oldPrimary?.cargo?.dockTaskId).toBeUndefined();
    expect(oldPrimary?.cargo?.dockVisits).toEqual([{ ...promotion, isWaitingInYard: true, unloadingPointId: undefined }]);
    expect(newDock?.cargo?.dockTaskId).toBe(promotion.taskId);
  });

  it('preserves parallel assignments and puts a waiting truck at the released dock only when it is assigned', () => {
    const first = { taskId: 'first', tripId: 'first-trip', unloadingPointId: 'D01' };
    const second = { taskId: 'second', tripId: 'second-trip', unloadingPointId: 'D02' };
    const waiting = { taskId: 'waiting', tripId: 'waiting-trip', unloadingPointId: undefined };
    const cargo: WarehouseCargoValue = {
      dockTaskId: second.taskId,
      dockVisits: [second, first, waiting],
      hasDock: true,
      units: [makeUnit('first', 'D01'), makeUnit('second', 'D02'), makeUnit('waiting', undefined)],
    };

    const [one, two] = splitWarehouseDockCargo(cargo, undefined, ['D01', 'D02']);
    expect(one?.cargo?.dockTaskId).toBe('first');
    expect(one?.cargo?.dockVisits).toEqual([first, waiting]);
    expect(two?.cargo?.dockTaskId).toBe('second');
    expect(two?.cargo?.units.map(unit => unit.id)).toEqual(['second']);

    const promoted = { ...waiting, unloadingPointId: 'D01' };
    const [afterOne, afterTwo] = splitWarehouseDockCargo({
      ...cargo,
      dockVisits: [second, promoted],
      units: [makeUnit('first', 'D01', 'staging'), makeUnit('second', 'D02'), makeUnit('waiting', 'D01')],
    }, undefined, ['D01', 'D02']);
    expect(afterOne?.cargo?.dockVisits).toEqual([promoted]);
    expect(afterOne?.cargo?.units[0]?.location).toBe('staging');
    expect(afterTwo).toEqual(two);
  });

  it('paints a cell in one lane and preserves the single dock presentation', () => {
    const cargo: WarehouseCargoValue = {
      dockTaskId: undefined, hasDock: true, units: [makeUnit('incoming', 'D02', 'cell')],
    };
    const balances = [
      create(StockBalanceSchema, { cellId: 'shared', handlingUnit: { id: 'incoming' } }),
      create(StockBalanceSchema, { cellId: 'shared', handlingUnit: { id: 'stock' } }),
    ];
    const [one, two] = splitWarehouseDockCargo(cargo, balances, ['D01', 'D02']);
    expect(one?.balances).toEqual([]);
    expect(two?.balances).toEqual(balances);
    expect(splitWarehouseDockCargo(cargo, balances, ['D01'])).toEqual([{ balances, cargo }]);
  });
});
