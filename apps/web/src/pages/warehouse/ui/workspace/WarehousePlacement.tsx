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

import { usePutAway } from '../../api/useWarehouseCommands';

interface WarehousePlacementProps {
  cells: ReadonlyMap<string, string>;
  handlingUnitId: string;
  onChanged: () => void;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

export const WarehousePlacement = ({ cells, handlingUnitId, onChanged, t, task }: WarehousePlacementProps): ReactElement => {
  const [cellId, setCellId] = useState('');
  const command = usePutAway(task, handlingUnitId, cellId, onChanged);
  const access = useCommandAccess(command.method, { kind: 'warehouse', warehouseId: task.warehouseId });

  const handleCellChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> WarehousePlacement -> handleCellChange:', {});
    command.reset();
    setCellId(event.currentTarget.value);
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
      <ActionButton access={access} command={command} data-testid="warehouse-place-unit" isDisabled={!cells.has(cellId)}>
        {t('warehouseWork.place')}
      </ActionButton>
    </div>
  );
};
