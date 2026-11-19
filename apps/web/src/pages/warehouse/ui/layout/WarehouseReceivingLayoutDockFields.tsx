import type { ReactElement } from 'react';

import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { useRef } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  Button,
  SwitchField,
  TextField,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type {
  ReceivingLayoutDefaultsValue,
  ReceivingLayoutFormValue,
} from '../../model/warehouseReceivingLayout';

import { RECEIVING_LAYOUT_DOCK_CAPACITY } from '../../api/useConfigureWarehouseReceivingLayoutForm';

type DockFieldPathValue = `docks.${number}`;

interface WarehouseReceivingLayoutDockFieldsProps {
  defaults: ReceivingLayoutDefaultsValue;
  form: CommandFormValue<ReceivingLayoutFormValue>;
  t: WarehouseWorkTranslate;
  warehouseCapabilities: readonly WarehouseCapability[];
}

const toDockPath = (index: number): DockFieldPathValue => `docks.${String(index)}` as DockFieldPathValue;

export const WarehouseReceivingLayoutDockFields = ({
  defaults, form, t, warehouseCapabilities,
}: WarehouseReceivingLayoutDockFieldsProps): ReactElement => {
  const pendingFocus = useRef<number | undefined>(undefined);
  const addRef = useRef<HTMLButtonElement>(null);
  const dockCount = form.watchField('dockCount');
  const canAdd = dockCount < RECEIVING_LAYOUT_DOCK_CAPACITY && !form.command.isPending;
  const canRemove = dockCount > defaults.values.dockCount && !form.command.isPending;
  const canChooseCold = warehouseCapabilities.includes(WarehouseCapability.COLD);
  const canChooseOversize = warehouseCapabilities.includes(WarehouseCapability.OVERSIZE);
  const hasUnavailableCapabilities = !canChooseCold || !canChooseOversize;

  const handleAdd = (): void => {
    const previous = Number(form.watchField(`${toDockPath(dockCount - 1)}.xMm`));
    const next = Number.isFinite(previous) && previous >= 0 && previous < 100_000 ? Math.ceil(previous / 100) * 100 + 2_700 : 0;
    pendingFocus.current = dockCount;
    form.setFieldValue(`${toDockPath(dockCount)}.xMm`, String(next));
    form.setFieldValue('dockCount', dockCount + 1);
  };

  const handleRemove = (): void => {
    const path = toDockPath(dockCount - 1);
    form.setFieldValue(`${path}.hasCold`, false);
    form.setFieldValue(`${path}.hasOversize`, false);
    form.setFieldValue(`${path}.xMm`, '0');
    form.setFieldValue('dockCount', dockCount - 1);
    addRef.current?.focus();
  };

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-base font-semibold">{t('warehouseWork.receivingLayoutDocks')}</legend>
      <p className="text-sm text-on-panel-muted">{t('warehouseWork.receivingLayoutDocksHint')}</p>
      {hasUnavailableCapabilities && <p className="text-sm text-on-panel-muted">{t('warehouseWork.receivingLayoutDockCapabilities')}</p>}
      {defaults.values.docks.slice(0, dockCount).map((_dock, index) => {
        const dock = defaults.docks[index];
        const path = toDockPath(index);
        const x = form.getFieldProps(`${path}.xMm`);
        const number = index + 1;
        const label = dock === undefined
          ? t('warehouseWork.receivingLayoutNewDock', { number })
          : t('warehouseWork.dock', { code: dock.code });

        const handleXRef = (element: HTMLInputElement | null): void => {
          x.ref(element);
          if (element !== null && pendingFocus.current === index) {
            pendingFocus.current = undefined;
            element.focus();
          }
        };

        return (
          <fieldset className="min-w-0 space-y-2 border-b border-line pb-3" data-testid="warehouse-receiving-layout-dock-entry" key={path}>
            <legend className="mb-2 text-sm font-semibold">{label}</legend>
            <div className="max-w-56" data-testid="warehouse-receiving-layout-dock-x">
              <TextField {...x} inputMode="numeric" label={t('warehouseWork.initializeOffsetX')} messageLines={2} ref={handleXRef} />
            </div>
            <div className="grid gap-2 @lg:grid-cols-2">
              <SwitchField
                {...form.getFieldProps(`${path}.hasCold`)}
                data-testid="warehouse-receiving-layout-dock-cold"
                isDisabled={!canChooseCold}
                label={t('warehouseWork.receivingLayoutCold')}
              />
              <SwitchField
                {...form.getFieldProps(`${path}.hasOversize`)}
                data-testid="warehouse-receiving-layout-dock-oversize"
                isDisabled={!canChooseOversize}
                label={t('warehouseWork.receivingLayoutOversize')}
              />
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button data-testid="warehouse-receiving-layout-add-dock" disabled={!canAdd} onClick={handleAdd} ref={addRef} variant="secondary">
          {t('warehouseWork.receivingLayoutAddDock')}
        </Button>
        {canRemove && (
          <Button onClick={handleRemove} variant="secondary">
            {t('warehouseWork.receivingLayoutRemoveLast')}
          </Button>
        )}
      </div>
    </fieldset>
  );
};
