import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ReactElement } from 'react';

import { Package } from 'lucide-react';
import { useMemo } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  EmptyState,
  ErrorNotice,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type { WarehouseRackFootprintValue } from '../../model/warehouseRackGrid';

import { useWarehouseLayoutDrafts } from '../../api/useWarehouseLayoutDrafts';
import { createWarehouseRackGrid } from '../../model/warehouseRackGrid';
import { WarehouseRackOverview } from './WarehouseRackGrid';

interface WarehouseLayoutObserverProps {
  t: WarehouseWorkTranslate;
  topology: null | WarehouseTopology;
  warehouseId: string;
}

const EMPTY_FOOTPRINT: WarehouseRackFootprintValue = { depthMm: 0, origin: { xMm: 0, zMm: 0 }, widthMm: 0 };

export const WarehouseLayoutObserver = ({ t, topology, warehouseId }: WarehouseLayoutObserverProps): ReactElement => {
  const { formatNumber, t: baseText } = useI18n();
  const { drafts, error, isDenied, isLoading, isRetrying, retry } = useWarehouseLayoutDrafts(topology, warehouseId);
  const grid = useMemo(
    () => createWarehouseRackGrid(topology, EMPTY_FOOTPRINT, undefined, drafts.map(({ footprint }) => footprint)),
    [drafts, topology],
  );

  if (isDenied) {
    return <EmptyState icon={Package} text={t('warehouseWork.noAccess')} />;
  }

  if (topology === null) {
    return <EmptyState icon={Package} text={t('warehouseWork.layoutEmpty')} />;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid="warehouse-layout-observer">
      <WarehouseRackOverview drafts={drafts} grid={grid} t={t} />
      {error !== null && <ErrorNotice error={error} isRetrying={isRetrying} onRetry={retry} />}
      {isLoading && <p className="text-sm text-on-panel-muted" role="status">{baseText('routing.section.loading')}</p>}
      <div aria-live="polite">
        {!isLoading && error === null && drafts.length === 0 && (
          <p className="text-sm text-on-panel-muted">{t('warehouseWork.rackDraftEmpty')}</p>
        )}
        {drafts.length > 0 && (
          <ul aria-label={t('warehouseWork.rackDraftList')} className="divide-y divide-line text-sm">
            {drafts.map(({ footprint, rowId, zoneId }) => {
              const zone = topology.storageZones.find(entry => entry.id === zoneId);
              const row = zone?.rows.find(entry => entry.id === rowId);
              const { xMm, zMm } = footprint.origin;
              return (
                <li className="flex flex-wrap items-baseline justify-between gap-x-3 py-2" key={zoneId}>
                  <span className="min-w-0 font-semibold wrap-anywhere">
                    {zone === undefined || row === undefined
                      ? t('warehouseWork.rackDraftMarker')
                      : t('warehouseWork.rackRowOption', { row: row.code, zone: zone.code })}
                  </span>
                  <span className="text-on-panel-muted tabular-nums">
                    {t('warehouseWork.rackPosition', { x: formatNumber(xMm), z: formatNumber(zMm) })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
