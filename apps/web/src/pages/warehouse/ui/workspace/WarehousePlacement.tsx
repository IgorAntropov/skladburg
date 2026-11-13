import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { useState } from 'react';

import { useCommandAccess } from '@/entities/session';
import {
  ActionButton,
  SelectField,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseScanHandlerValue } from './WarehouseScanner';

import { usePutAway } from '../../api/useWarehouseCommands';
import { WarehouseScanner } from './WarehouseScanner';

interface WarehousePlacementProps {
  cells: ReadonlyMap<string, string>;
  handlingUnitId: string;
  onCellSelect: (id: string, taskId: string) => void;
  onChanged: () => void;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

export const WarehousePlacement = ({ cells, handlingUnitId, onCellSelect, onChanged, t, task }: WarehousePlacementProps): ReactElement => {
  const [cellId, setCellId] = useState('');
  const command = usePutAway(task, handlingUnitId, cellId, onChanged);
  const access = useCommandAccess(command.method, { kind: 'warehouse', warehouseId: task.warehouseId });

  const selectCell = (id: string): void => {
    command.reset();
    setCellId(id);
  };

  const handleCellChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> WarehousePlacement -> handleCellChange:', {});
    selectCell(event.currentTarget.value);
  };

  const handleScan: WarehouseScanHandlerValue = (raw, { readCell }) => {
    const id = readCell(raw, cells);
    if (id === undefined) {
      return 'warehouseWork.error.invalidCode';
    }
    selectCell(id);
    onCellSelect(id, task.id);
    return undefined;
  };

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="warehouse-placement">
      <SelectField
        isReadOnly={command.isPending}
        label={t('warehouseWork.cell')}
        name="warehouse-placement-cell"
        onChange={handleCellChange}
        value={cellId}
      >
        <option value="" />
        {[...cells].map(([id, code]) => <option key={id} value={id}>{code}</option>)}
      </SelectField>
      {access.status === 'allowed' && <WarehouseScanner isReadOnly={command.isPending} onScan={handleScan} t={t} />}
      <ActionButton access={access} command={command} data-testid="warehouse-place-unit" isDisabled={!cells.has(cellId)}>
        {t('warehouseWork.place')}
      </ActionButton>
    </div>
  );
};
