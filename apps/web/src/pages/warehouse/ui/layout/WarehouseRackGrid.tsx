import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  RefObject,
} from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import type { WarehouseLayoutPreviewValue } from '../../api/useWarehouseLayoutDrafts';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';
import type {
  WarehouseRackFootprintValue,
  WarehouseRackGridObstacleValue,
  WarehouseRackGridValue,
  WarehouseRackPositionValue,
} from '../../model/warehouseRackGrid';

import {
  snapWarehouseRackPosition,
  WAREHOUSE_RACK_GRID_STEP_MM,
} from '../../model/warehouseRackGrid';

interface RackGridSurfaceProps {
  drafts?: readonly WarehouseLayoutPreviewValue[] | undefined;
  grid: WarehouseRackGridValue;
  t: WarehouseWorkTranslate;
}

interface WarehouseRackGridProps extends RackGridSurfaceProps {
  boardRef: RefObject<HTMLButtonElement | null>;
  footprint: WarehouseRackFootprintValue;
  isReadOnly: boolean;
  obstacle: undefined | WarehouseRackGridObstacleValue;
  onMove: (position: WarehouseRackPositionValue) => void;
}

const DIRECTIONS = new Map<string, WarehouseRackPositionValue>([
  ['ArrowDown', { xMm: 0, zMm: WAREHOUSE_RACK_GRID_STEP_MM }],
  ['ArrowLeft', { xMm: -WAREHOUSE_RACK_GRID_STEP_MM, zMm: 0 }],
  ['ArrowRight', { xMm: WAREHOUSE_RACK_GRID_STEP_MM, zMm: 0 }],
  ['ArrowUp', { xMm: 0, zMm: -WAREHOUSE_RACK_GRID_STEP_MM }],
]);

const RACK = 'border border-line-strong bg-line';
const RECEIVING = 'border border-dashed border-line-strong bg-skeleton';
const DRAFT = 'border-2 border-dashed border-indicator bg-indicator/10';
const SELECTION = 'border-2 border-indicator bg-indicator/20';
const BLOCKED_SELECTION = 'border-2 border-dashed border-status-alarm bg-status-alarm/25';
const GRID_LINE_MM = 1_000;
const MAX_GRID_LINES = 24;
const GRID_IMAGE = [
  'linear-gradient(to right,var(--color-line) 1px,transparent 1px)',
  'linear-gradient(to bottom,var(--color-line) 1px,transparent 1px)',
].join(',');
const BOARD = [
  'relative block max-h-96 min-h-40 w-full cursor-crosshair overflow-hidden border border-line-strong bg-panel-solid p-0',
  'enabled:not-aria-disabled:hover:bg-panel-solid enabled:not-aria-disabled:active:bg-panel-solid',
  'enabled:not-aria-disabled:motion-safe:active:scale-100 aria-disabled:not-aria-busy:cursor-default',
].join(' ');

const asPercent = (mm: number, totalMm: number): string => `${String(mm / totalMm * 100)}%`;

const getMarkerStyle = (footprint: WarehouseRackFootprintValue, grid: WarehouseRackGridValue): CSSProperties => ({
  height: asPercent(footprint.depthMm, grid.depthMm),
  left: asPercent(footprint.origin.xMm, grid.widthMm),
  top: asPercent(footprint.origin.zMm, grid.depthMm),
  width: asPercent(footprint.widthMm, grid.widthMm),
});

const getGridSpacing = (sizeMm: number): string =>
  asPercent(Math.ceil(sizeMm / (MAX_GRID_LINES * GRID_LINE_MM)) * GRID_LINE_MM, sizeMm);

const getBoardStyle = (grid: WarehouseRackGridValue): CSSProperties => ({
  aspectRatio: grid.widthMm / grid.depthMm,
  backgroundImage: GRID_IMAGE,
  backgroundSize: `${getGridSpacing(grid.widthMm)} ${getGridSpacing(grid.depthMm)}`,
});

type RackMarkersProps = Pick<RackGridSurfaceProps, 'drafts' | 'grid'>;

const RackMarkers = ({ drafts, grid }: RackMarkersProps): ReactElement => (
  <>
    {grid.obstacles.map(({ footprint, id, kind }) => (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${kind === 'rack' ? RACK : RECEIVING}`}
        data-testid="warehouse-rack-grid-obstacle"
        data-x-mm={footprint.origin.xMm}
        data-z-mm={footprint.origin.zMm}
        key={id}
        style={getMarkerStyle(footprint, grid)}
      />
    ))}
    {drafts?.map(({ footprint, zoneId }) => (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${DRAFT}`}
        data-testid="warehouse-layout-draft"
        data-x-mm={footprint.origin.xMm}
        data-z-mm={footprint.origin.zMm}
        data-zone-id={zoneId}
        key={zoneId}
        style={getMarkerStyle(footprint, grid)}
      />
    ))}
  </>
);

interface RackLegendProps {
  hasDrafts: boolean;
  selectionClassName?: string | undefined;
  t: WarehouseWorkTranslate;
}

const RackLegend = ({ hasDrafts, selectionClassName, t }: RackLegendProps): ReactElement => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-panel-muted">
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-3 ${RACK}`} />
      {t('warehouseWork.rackGridExisting')}
    </li>
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-3 ${RECEIVING}`} />
      {t('warehouseWork.receivingArea')}
    </li>
    {selectionClassName !== undefined && (
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className={`size-3 ${selectionClassName}`} />
        {t('warehouseWork.rackGridNew')}
      </li>
    )}
    {hasDrafts && (
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className={`size-3 ${DRAFT}`} />
        {t('warehouseWork.rackDraftMarker')}
      </li>
    )}
  </ul>
);

export const WarehouseRackOverview = ({ drafts, grid, t }: RackGridSurfaceProps): ReactElement => (
  <div className="space-y-2">
    <div
      aria-hidden="true"
      className="relative max-h-96 min-h-40 w-full overflow-hidden rounded-control border border-line-strong bg-panel-solid"
      style={getBoardStyle(grid)}
    >
      <RackMarkers drafts={drafts} grid={grid} />
    </div>
    <RackLegend hasDrafts={drafts !== undefined && drafts.length > 0} t={t} />
  </div>
);

export const WarehouseRackGrid = ({
  boardRef,
  drafts,
  footprint,
  grid,
  isReadOnly,
  obstacle,
  onMove,
  t,
}: WarehouseRackGridProps): ReactElement => {
  const { formatNumber } = useI18n();
  const hintId = useId();
  const { origin } = footprint;
  const status = obstacle?.kind === 'rack'
    ? t('warehouseWork.rackGridBlockedRack')
    : obstacle === undefined ? t('warehouseWork.rackGridFree') : t('warehouseWork.rackGridBlockedReceiving');
  const selectionClassName = obstacle === undefined ? SELECTION : BLOCKED_SELECTION;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isReadOnly || event.detail === 0) {
      return;
    }

    const { clientHeight, clientLeft, clientTop, clientWidth } = event.currentTarget;
    const { left, top } = event.currentTarget.getBoundingClientRect();
    const xMm = (event.clientX - left - clientLeft) / clientWidth * grid.widthMm - footprint.widthMm / 2;
    const zMm = (event.clientY - top - clientTop) / clientHeight * grid.depthMm - footprint.depthMm / 2;
    event.currentTarget.focus({ preventScroll: true });
    onMove(snapWarehouseRackPosition(grid, { xMm, zMm }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const direction = DIRECTIONS.get(event.key);
    if (isReadOnly || direction === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    onMove(snapWarehouseRackPosition(grid, { xMm: origin.xMm + direction.xMm, zMm: origin.zMm + direction.zMm }));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-on-panel-muted" id={hintId}>{t('warehouseWork.rackGridHint')}</p>
      <Button
        aria-describedby={hintId}
        aria-disabled={isReadOnly || undefined}
        aria-label={t('warehouseWork.rackGridLabel')}
        className={BOARD}
        data-testid="warehouse-rack-grid"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={boardRef}
        style={getBoardStyle(grid)}
        variant="ghost"
      >
        <RackMarkers drafts={drafts} grid={grid} />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute ${selectionClassName}`}
          data-testid="warehouse-rack-grid-selection"
          data-x-mm={origin.xMm}
          data-z-mm={origin.zMm}
          style={getMarkerStyle(footprint, grid)}
        />
      </Button>
      <RackLegend hasDrafts={drafts !== undefined && drafts.length > 0} selectionClassName={selectionClassName} t={t} />
      <p className="text-sm font-semibold" data-obstacle-kind={obstacle?.kind} data-testid="warehouse-rack-grid-status" role="status">
        <span className="sr-only">
          {t('warehouseWork.rackPosition', { x: formatNumber(origin.xMm), z: formatNumber(origin.zMm) })}
          {' · '}
        </span>
        {status}
      </p>
    </div>
  );
};
