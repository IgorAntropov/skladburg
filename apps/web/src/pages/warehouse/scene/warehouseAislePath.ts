export interface WarehouseAislePointValue {
  x: number;
  z: number;
}

export interface WarehouseAisleRectValue {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

interface WarehouseAisleGridValue {
  columns: number;
  occupied: Int32Array;
  rows: number;
  stepX: number;
  stepZ: number;
}

const CELL_SIZE = 0.16;
const GRID_CELL_LIMIT = 65_536;
const SHORTCUT_LIMIT = 96;
const OBSTACLE_CHECK_LIMIT = 200_000;
const GRID_ROUNDING_MARGIN = 1e-9;
const UNVISITED = -1;

const isValidRect = ({ maxX, maxZ, minX, minZ }: WarehouseAisleRectValue): boolean => (
  minX <= maxX && minZ <= maxZ && Number.isFinite(maxX - minX) && Number.isFinite(maxZ - minZ)
);

const insetBounds = (bounds: WarehouseAisleRectValue, clearance: number): undefined | WarehouseAisleRectValue => {
  if (!isValidRect(bounds) || !Number.isFinite(clearance) || clearance < 0) {
    return undefined;
  }
  const inset = {
    maxX: bounds.maxX - clearance,
    maxZ: bounds.maxZ - clearance,
    minX: bounds.minX + clearance,
    minZ: bounds.minZ + clearance,
  };
  return isValidRect(inset) ? inset : undefined;
};

const isWithin = (bounds: WarehouseAisleRectValue, { x, z }: WarehouseAislePointValue): boolean => (
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
);

const intersectsObstacle = (
  rect: WarehouseAisleRectValue,
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  clearance: number,
): boolean => {
  const minX = rect.minX - clearance;
  const minZ = rect.minZ - clearance;
  const maxX = rect.maxX + clearance;
  const maxZ = rect.maxZ + clearance;
  if (Math.max(from.x, to.x) < minX || Math.min(from.x, to.x) > maxX
    || Math.max(from.z, to.z) < minZ || Math.min(from.z, to.z) > maxZ) {
    return false;
  }

  const deltaX = to.x - from.x;
  const deltaZ = to.z - from.z;
  if (deltaX === 0 || deltaZ === 0) {
    return true;
  }

  const entryX = ((deltaX > 0 ? minX : maxX) - from.x) / deltaX;
  const entryZ = ((deltaZ > 0 ? minZ : maxZ) - from.z) / deltaZ;
  const exitX = ((deltaX > 0 ? maxX : minX) - from.x) / deltaX;
  const exitZ = ((deltaZ > 0 ? maxZ : minZ) - from.z) / deltaZ;
  return Math.max(entryX, entryZ, 0) <= Math.min(exitX, exitZ, 1) + 4 * Number.EPSILON;
};

const hasClearLine = (
  obstacles: readonly WarehouseAisleRectValue[],
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  clearance: number,
): boolean => !obstacles.some(rect => intersectsObstacle(rect, from, to, clearance));

export const isWarehouseAisleSegmentOpen = (
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  clearance: number,
): boolean => {
  const inset = insetBounds(bounds, clearance);
  return inset !== undefined && isWithin(inset, from) && isWithin(inset, to)
    && obstacles.every(rect => isValidRect(rect) && !intersectsObstacle(rect, from, to, clearance));
};

export const isWarehouseAislePointOpen = (
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  point: WarehouseAislePointValue,
  clearance: number,
): boolean => isWarehouseAisleSegmentOpen(bounds, obstacles, point, point, clearance);

const buildGrid = (
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  clearance: number,
): undefined | WarehouseAisleGridValue => {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const size = Math.max(CELL_SIZE, width / (GRID_CELL_LIMIT / 2), depth / (GRID_CELL_LIMIT / 2),
    Math.sqrt(width) / Math.sqrt(GRID_CELL_LIMIT / 2) * Math.sqrt(depth));
  const columns = Math.max(1, Math.ceil(width / size));
  const rows = Math.max(1, Math.ceil(depth / size));
  const stepX = width / columns;
  const stepZ = depth / rows;
  if (columns * rows > GRID_CELL_LIMIT || stepX <= 0 || stepZ <= 0) {
    return undefined;
  }

  const stride = columns + 1;
  const occupied = new Int32Array(stride * (rows + 1));
  const addEdge = (column: number, row: number, change: number): void => {
    const index = row * stride + column;
    occupied[index] = (occupied[index] ?? 0) + change;
  };

  for (const rect of obstacles) {
    const firstColumn = Math.max(0, Math.ceil((rect.minX - clearance - bounds.minX) / stepX - 1 - GRID_ROUNDING_MARGIN));
    const firstRow = Math.max(0, Math.ceil((rect.minZ - clearance - bounds.minZ) / stepZ - 1 - GRID_ROUNDING_MARGIN));
    const lastColumn = Math.min(columns - 1, Math.floor((rect.maxX + clearance - bounds.minX) / stepX + GRID_ROUNDING_MARGIN));
    const lastRow = Math.min(rows - 1, Math.floor((rect.maxZ + clearance - bounds.minZ) / stepZ + GRID_ROUNDING_MARGIN));

    if (firstColumn <= lastColumn && firstRow <= lastRow) {
      addEdge(firstColumn, firstRow, 1);
      addEdge(lastColumn + 1, firstRow, -1);
      addEdge(firstColumn, lastRow + 1, -1);
      addEdge(lastColumn + 1, lastRow + 1, 1);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    let rowTotal = 0;
    for (let column = 0; column < columns; column += 1) {
      const index = row * stride + column;
      rowTotal += occupied[index] ?? 0;
      occupied[index] = rowTotal + (occupied[index - stride] ?? 0);
    }
  }
  return { columns, occupied, rows, stepX, stepZ };
};

const gridPoint = (grid: WarehouseAisleGridValue, bounds: WarehouseAisleRectValue, index: number): WarehouseAislePointValue => ({
  x: bounds.minX + (index % (grid.columns + 1) + 0.5) * grid.stepX,
  z: bounds.minZ + (Math.floor(index / (grid.columns + 1)) + 0.5) * grid.stepZ,
});

const readConnections = (
  grid: WarehouseAisleGridValue,
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  point: WarehouseAislePointValue,
  clearance: number,
): number[] => {
  const column = Math.min(grid.columns - 1, Math.floor((point.x - bounds.minX) / grid.stepX));
  const row = Math.min(grid.rows - 1, Math.floor((point.z - bounds.minZ) / grid.stepZ));
  const connections: number[] = [];

  for (let nextRow = Math.max(0, row - 1); nextRow <= Math.min(grid.rows - 1, row + 1); nextRow += 1) {
    for (let nextColumn = Math.max(0, column - 1); nextColumn <= Math.min(grid.columns - 1, column + 1); nextColumn += 1) {
      const index = nextRow * (grid.columns + 1) + nextColumn;
      if (grid.occupied[index] === 0 && hasClearLine(obstacles, point, gridPoint(grid, bounds, index), clearance)) {
        connections.push(index);
      }
    }
  }
  return connections;
};

const pushRoutePoint = (route: WarehouseAislePointValue[], point: WarehouseAislePointValue): void => {
  const before = route.at(-2);
  const last = route.at(-1);
  if (before !== undefined && last !== undefined
    && ((before.x === last.x && last.x === point.x) || (before.z === last.z && last.z === point.z))) {
    route.pop();
  }
  route.push(point);
};

const traceGridPath = (
  grid: WarehouseAisleGridValue,
  bounds: WarehouseAisleRectValue,
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  parents: Int32Array,
  end: number,
): WarehouseAislePointValue[] => {
  const route = [to];
  let current = end;
  while (current !== UNVISITED) {
    pushRoutePoint(route, gridPoint(grid, bounds, current));
    const parent = parents[current];
    current = parent === current ? UNVISITED : parent ?? UNVISITED;
  }
  pushRoutePoint(route, from);
  return route.reverse();
};

const findGridPath = (
  grid: WarehouseAisleGridValue,
  bounds: WarehouseAisleRectValue,
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  starts: readonly number[],
  ends: ReadonlySet<number>,
): undefined | WarehouseAislePointValue[] => {
  const parents = new Int32Array(grid.occupied.length).fill(UNVISITED);
  const queue = new Int32Array(grid.columns * grid.rows);
  const stride = grid.columns + 1;
  let tail = 0;
  const enqueue = (current: number, parent: number): void => {
    if (grid.occupied[current] === 0 && parents[current] === UNVISITED) {
      parents[current] = parent;
      queue[tail] = current;
      tail += 1;
    }
  };

  for (const start of starts) {
    enqueue(start, start);
  }
  for (let head = 0; head < tail; head += 1) {
    const current = queue[head] ?? 0;
    if (ends.has(current)) {
      return traceGridPath(grid, bounds, from, to, parents, current);
    }
    if (current % stride > 0) {
      enqueue(current - 1, current);
    }
    if (current % stride < grid.columns - 1) {
      enqueue(current + 1, current);
    }
    if (current >= stride) {
      enqueue(current - stride, current);
    }
    if (current < (grid.rows - 1) * stride) {
      enqueue(current + stride, current);
    }
  }
  return undefined;
};

const shortenPath = (
  path: readonly WarehouseAislePointValue[],
  obstacles: readonly WarehouseAisleRectValue[],
  from: WarehouseAislePointValue,
  clearance: number,
): WarehouseAislePointValue[] => {
  let remaining = Math.min(SHORTCUT_LIMIT, Math.floor(OBSTACLE_CHECK_LIMIT / Math.max(1, obstacles.length)));
  const shortened = [from];
  let anchor = from;
  let prev = from;

  for (const point of path.slice(1)) {
    if (anchor !== prev) {
      if (remaining <= 0 || !hasClearLine(obstacles, anchor, point, clearance)) {
        shortened.push(prev);
        anchor = prev;
      }
      remaining -= 1;
    }
    prev = point;
  }
  shortened.push(prev);
  return shortened;
};

const isPathClear = (
  path: readonly WarehouseAislePointValue[],
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  clearance: number,
): boolean => (path.length - 1) * obstacles.length <= OBSTACLE_CHECK_LIMIT && path.every((point, index) => {
  const prev = path[index - 1];
  return isWithin(bounds, point) && (prev === undefined || hasClearLine(obstacles, prev, point, clearance));
});

export const findWarehouseAislePath = (
  bounds: WarehouseAisleRectValue,
  obstacles: readonly WarehouseAisleRectValue[],
  from: WarehouseAislePointValue,
  to: WarehouseAislePointValue,
  clearance: number,
): readonly WarehouseAislePointValue[] | undefined => {
  const inset = insetBounds(bounds, clearance);
  if (inset === undefined || !isWithin(inset, from) || !isWithin(inset, to) || !obstacles.every(isValidRect)) {
    return undefined;
  }
  if (hasClearLine(obstacles, from, to, clearance)) {
    return [from, to];
  }
  if (!hasClearLine(obstacles, from, from, clearance) || !hasClearLine(obstacles, to, to, clearance)) {
    return undefined;
  }

  const grid = buildGrid(inset, obstacles, clearance);
  if (grid === undefined) {
    return undefined;
  }
  const starts = readConnections(grid, inset, obstacles, from, clearance);
  const ends = new Set(readConnections(grid, inset, obstacles, to, clearance));
  if (starts.length === 0 || ends.size === 0) {
    return undefined;
  }
  const path = findGridPath(grid, inset, from, to, starts, ends);
  if (path === undefined) {
    return undefined;
  }
  const shortened = shortenPath(path, obstacles, from, clearance);
  return isPathClear(shortened, inset, obstacles, clearance) ? shortened : undefined;
};
