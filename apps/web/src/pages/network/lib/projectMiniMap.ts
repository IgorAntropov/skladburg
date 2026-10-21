import type { NetworkMapModelValue } from '@/entities/network';

export interface MiniMapPointValue {
  id: string;
  x: number;
  y: number;
}

export interface MiniMapProjectionValue {
  aspectRatio: number;
  cities: readonly MiniMapPointValue[];
  roads: readonly MiniMapRoadValue[];
}

export interface MiniMapRoadValue {
  from: MiniMapPointValue;
  id: string;
  to: MiniMapPointValue;
}

const CENTER_FRACTION = 0.5;

export const projectMiniMap = (model: NetworkMapModelValue, paddingFraction: number): MiniMapProjectionValue => {
  if (model.cities.length === 0) {
    return { aspectRatio: 1, cities: [], roads: [] };
  }

  const columns = model.cities.map(city => city.position.column);
  const rows = model.cities.map(city => city.position.row);
  const minColumn = Math.min(...columns);
  const minRow = Math.min(...rows);
  const columnSpan = Math.max(...columns) - minColumn;
  const rowSpan = Math.max(...rows) - minRow;
  const longestSpan = Math.max(columnSpan, rowSpan);

  const cities: MiniMapPointValue[] = [];

  let aspectRatio = 1;

  if (longestSpan === 0) {
    for (const city of model.cities) {
      cities.push({ id: city.id, x: CENTER_FRACTION, y: CENTER_FRACTION });
    }
  }
  else {
    const padding = Math.max(0, paddingFraction) * longestSpan;
    const width = columnSpan + 2 * padding;
    const height = rowSpan + 2 * padding;

    aspectRatio = width / height;

    for (const city of model.cities) {
      cities.push({
        id: city.id,
        x: (city.position.column - minColumn + padding) / width,
        y: (city.position.row - minRow + padding) / height,
      });
    }
  }

  const pointByCityId = new Map(cities.map(point => [point.id, point]));
  const roads: MiniMapRoadValue[] = [];

  for (const road of model.roads) {
    const from = pointByCityId.get(road.fromNodeId);
    const to = pointByCityId.get(road.toNodeId);

    if (from !== undefined && to !== undefined) {
      roads.push({ from, id: road.id, to });
    }
  }

  return { aspectRatio, cities, roads };
};
