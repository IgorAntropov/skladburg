import type { WorldModelRoleValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { RgbValue } from './colormapGrid.ts';

interface RoleAnchorValue {
  color: RgbValue;
  role: WorldModelRoleValue;
}

export const ROLE_ANCHORS: readonly RoleAnchorValue[] = [
  { color: { blue: 233, green: 220, red: 220 }, role: 'light' },
  { color: { blue: 179, green: 149, red: 142 }, role: 'mid' },
  { color: { blue: 88, green: 74, red: 71 }, role: 'dark' },
  { color: { blue: 236, green: 189, red: 155 }, role: 'glass' },
  { color: { blue: 255, green: 230, red: 205 }, role: 'glass' },
  { color: { blue: 121, green: 166, red: 61 }, role: 'green' },
  { color: { blue: 68, green: 135, red: 255 }, role: 'orange' },
  { color: { blue: 73, green: 179, red: 255 }, role: 'amber' },
  { color: { blue: 52, green: 213, red: 255 }, role: 'yellow' },
  { color: { blue: 62, green: 78, red: 231 }, role: 'red' },
  { color: { blue: 86, green: 123, red: 208 }, role: 'terracotta' },
];

const getDistance = (current: RgbValue, prev: RgbValue): number => (
  (current.red - prev.red) ** 2 + (current.green - prev.green) ** 2 + (current.blue - prev.blue) ** 2
);

export const classifyColor = (color: RgbValue): WorldModelRoleValue => {
  let nearest: RoleAnchorValue | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const anchor of ROLE_ANCHORS) {
    const distance = getDistance(color, anchor.color);

    if (distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }

  return nearest?.role ?? 'mid';
};
