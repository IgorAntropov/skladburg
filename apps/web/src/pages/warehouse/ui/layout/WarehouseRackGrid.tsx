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

interface WarehouseRackGridProps {
  boardRef: RefObject<HTMLButtonElement | null>;
  footprint: WarehouseRackFootprintValue;
  grid: WarehouseRackGridValue;
  isReadOnly: boolean;
  obstacle: undefined | WarehouseRackGridObstacleValue;
  onMove: (position: WarehouseRackPositionValue) => void;
  t: WarehouseWorkTranslate;
}

const DIRECTIONS = new Map<string, WarehouseRackPositionValue>([
  ['ArrowDown', { xMm: 0, zMm: WAREHOUSE_RACK_GRID_STEP_MM }],
  ['ArrowLeft', { xMm: -WAREHOUSE_RACK_GRID_STEP_MM, zMm: 0 }],
  ['ArrowRight', { xMm: WAREHOUSE_RACK_GRID_STEP_MM, zMm: 0 }],
  ['ArrowUp', { xMm: 0, zMm: -WAREHOUSE_RACK_GRID_STEP_MM }],
]);

const RACK = 'border border-line-strong bg-line';
const RECEIVING = 'border border-dashed border-line-strong bg-skeleton';
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

export const WarehouseRackGrid = ({
  boardRef,
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
        style={{
          aspectRatio: grid.widthMm / grid.depthMm,
          backgroundImage: GRID_IMAGE,
          backgroundSize: `${getGridSpacing(grid.widthMm)} ${getGridSpacing(grid.depthMm)}`,
        }}
        variant="ghost"
      >
        {grid.obstacles.map(({ footprint: occupied, id, kind }) => (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute ${kind === 'rack' ? RACK : RECEIVING}`}
            data-testid="warehouse-rack-grid-obstacle"
            data-x-mm={occupied.origin.xMm}
            data-z-mm={occupied.origin.zMm}
            key={id}
            style={getMarkerStyle(occupied, grid)}
          />
        ))}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute ${obstacle === undefined ? SELECTION : BLOCKED_SELECTION}`}
          data-testid="warehouse-rack-grid-selection"
          data-x-mm={origin.xMm}
          data-z-mm={origin.zMm}
          style={getMarkerStyle(footprint, grid)}
        />
      </Button>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-panel-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-3 ${RACK}`} />
          {t('warehouseWork.rackGridExisting')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-3 ${RECEIVING}`} />
          {t('warehouseWork.receivingArea')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-3 ${obstacle === undefined ? SELECTION : BLOCKED_SELECTION}`} />
          {t('warehouseWork.rackGridNew')}
        </li>
      </ul>
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
