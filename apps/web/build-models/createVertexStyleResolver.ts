import type { WorldModelRoleValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { PngImageValue } from './decodePng.ts';

import {
  encodeWorldModelShade,
  WORLD_MODEL_SHADE_RANGE,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import {
  getLuminance,
  getMeanColor,
  sampleCell,
  sampleCellRows,
  toCellFraction,
  toCellId,
} from './colormapGrid.ts';
import { classifyColor } from './colorRoles.ts';

export interface VertexStyleValue {
  role: WorldModelRoleValue;
  shadeByte: number;
}

interface CellStyleValue {
  meanLuminance: number;
  role: WorldModelRoleValue;
}

const [MIN_SHADE, MAX_SHADE] = WORLD_MODEL_SHADE_RANGE;

export const createVertexStyleResolver = (colormap: PngImageValue): ((u: number, v: number) => VertexStyleValue) => {
  const cellStyles = new Map<number, CellStyleValue>();

  const getCellStyle = (cellId: number): CellStyleValue => {
    const cached = cellStyles.get(cellId);

    if (cached !== undefined) {
      return cached;
    }

    const rows = sampleCellRows(colormap, cellId);
    const style: CellStyleValue = {
      meanLuminance: rows.reduce((sum, color) => sum + getLuminance(color), 0) / Math.max(1, rows.length),
      role: classifyColor(getMeanColor(rows)),
    };

    cellStyles.set(cellId, style);

    return style;
  };

  return (u, v) => {
    const cellId = toCellId(u, v);
    const style = getCellStyle(cellId);
    const luminance = getLuminance(sampleCell(colormap, cellId, toCellFraction(v)));
    const shade = style.meanLuminance === 0 ? 1 : Math.min(MAX_SHADE, Math.max(MIN_SHADE, luminance / style.meanLuminance));

    return { role: style.role, shadeByte: encodeWorldModelShade(shade) };
  };
};
