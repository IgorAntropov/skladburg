import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { WarehouseReceivingLayoutService } from '@skladburg/contracts/wms/v1/receiving_layout';
import { Truck } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { useI18n } from '@/shared/i18n';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import {
  AccessButton,
  Button,
  EmptyState,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { canInitializeWarehouseLayout } from '../../model/canInitializeWarehouseLayout';
import {
  createWarehouseRackGrid,
  hasWarehouseRackOrigin,
} from '../../model/warehouseRackGrid';
import {
  readReceivingDockCapabilities,
  readReceivingLayoutDocks,
} from '../../model/warehouseReceivingLayout';
import { WarehouseLayoutSlot } from './WarehouseLayoutSlot';
import { WarehouseRackOverview } from './WarehouseRackGrid';

interface WarehouseReceivingLayoutPanelProps {
  onBack: () => void;
  onEditingChange: (isEditing: boolean) => void;
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
  topology: null | WarehouseTopology;
  warehouseCapabilities: readonly WarehouseCapability[];
  warehouseId: string;
}

const loadReceivingLayoutForm = createCachedModuleLoader(() => import('./WarehouseReceivingLayoutForm'));

export const WarehouseReceivingLayoutPanel = ({
  onBack, onEditingChange, query, t, topology, warehouseCapabilities, warehouseId,
}: WarehouseReceivingLayoutPanelProps): ReactElement => {
  const { formatNumber } = useI18n();
  const { configureWarehouseReceivingLayout } = WarehouseReceivingLayoutService.method;
  const access = useCommandAccess(configureWarehouseReceivingLayout, { kind: 'warehouse', warehouseId });
  const [editingTopology, setEditingTopology] = useState<WarehouseTopology>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const isReturning = useRef(false);
  const canEdit = topology !== null && !canInitializeWarehouseLayout(topology);
  const area = topology?.receivingArea;
  const footprint = area?.footprint;
  const confirmedFootprint = hasWarehouseRackOrigin(footprint) ? footprint : undefined;
  const docks = readReceivingLayoutDocks(area);

  const handleEdit = (): void => {
    if (access.status === 'allowed' && canEdit) {
      setEditingTopology(topology);
    }
  };

  const handleClose = (): void => {
    isReturning.current = true;
    setEditingTopology(undefined);
  };

  useEffect(() => {
    if (editingTopology === undefined) {
      const target = isReturning.current ? editRef.current ?? headingRef.current : headingRef.current;
      isReturning.current = false;
      target?.focus();
    }
  }, [editingTopology]);

  if (editingTopology !== undefined) {
    return (
      <WarehouseLayoutSlot loader={loadReceivingLayoutForm}>
        {({ WarehouseReceivingLayoutForm }) => (
          <WarehouseReceivingLayoutForm
            initialTopology={editingTopology}
            onClose={handleClose}
            onEditingChange={onEditingChange}
            query={query}
            t={t}
            warehouseCapabilities={warehouseCapabilities}
            warehouseId={warehouseId}
          />
        )}
      </WarehouseLayoutSlot>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-receiving-layout">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onBack} variant="ghost">{t('warehouseWork.receivingLayoutBack')}</Button>
        <AccessButton
          access={access}
          data-testid="warehouse-receiving-layout-edit"
          isDisabled={!canEdit || query.isFetching}
          onClick={handleEdit}
          ref={editRef}
          variant="secondary"
        >
          {t('warehouseWork.receivingLayoutEdit')}
        </AccessButton>
      </div>
      <h3 className="text-base font-semibold" ref={headingRef} tabIndex={-1}>{t('warehouseWork.receivingLayout')}</h3>
      {confirmedFootprint === undefined
        ? <EmptyState icon={Truck} text={t('warehouseWork.receivingLayoutEmpty')} />
        : (
            <div className="space-y-3">
              <WarehouseRackOverview grid={createWarehouseRackGrid(topology, confirmedFootprint)} t={t} />
              <div
                className="text-sm text-on-panel-muted tabular-nums"
                data-depth-mm={confirmedFootprint.depthMm}
                data-testid="warehouse-receiving-layout-footprint"
                data-width-mm={confirmedFootprint.widthMm}
                data-x-mm={confirmedFootprint.origin.xMm}
                data-z-mm={confirmedFootprint.origin.zMm}
              >
                {t('warehouseWork.rackPosition', {
                  x: formatNumber(confirmedFootprint.origin.xMm), z: formatNumber(confirmedFootprint.origin.zMm),
                })}
                {' · '}
                {t('warehouseWork.rackSize', {
                  depth: formatNumber(confirmedFootprint.depthMm), width: formatNumber(confirmedFootprint.widthMm),
                })}
              </div>
              <ul aria-label={t('warehouseWork.receivingLayoutDocks')} className="divide-y divide-line">
                {docks.map((dock) => {
                  const { code, id, position } = dock;
                  const capabilities = readReceivingDockCapabilities(dock, docks.length, warehouseCapabilities);
                  const capabilityLabels = [t('warehouseWork.receivingLayoutRamp')];
                  if (capabilities.includes(WarehouseCapability.COLD)) {
                    capabilityLabels.push(t('warehouseWork.receivingLayoutCold'));
                  }
                  if (capabilities.includes(WarehouseCapability.OVERSIZE)) {
                    capabilityLabels.push(t('warehouseWork.receivingLayoutOversize'));
                  }

                  return (
                    <li
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm"
                      data-dock-code={code}
                      data-testid="warehouse-receiving-layout-dock"
                      data-x-mm={position?.xMm}
                      data-z-mm={position?.zMm}
                      key={id}
                    >
                      <span className="font-semibold">{t('warehouseWork.dock', { code })}</span>
                      {position !== undefined && (
                        <span className="tabular-nums">
                          {t('warehouseWork.rackPosition', { x: formatNumber(position.xMm), z: formatNumber(position.zMm) })}
                        </span>
                      )}
                      <span className="text-on-panel-muted">{capabilityLabels.join(', ')}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
    </section>
  );
};
