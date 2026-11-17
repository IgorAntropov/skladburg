import type { WorldTerrainValue } from '@/shared/3d';

export const selectNetworkLand = (terrain: WorldTerrainValue): Pick<WorldTerrainValue, 'groundGroups' | 'groundIndex'> => {
  const retained = terrain.groundGroups.filter(({ key }) => key === 'ground' || key === 'groundAlt' || key === 'sand');
  const indexCount = retained.reduce((total, group) => total + group.count, 0);
  const groundIndex = terrain.groundIndex instanceof Uint16Array ? new Uint16Array(indexCount) : new Uint32Array(indexCount);
  let start = 0;

  const groundGroups = retained.map((group) => {
    const next = { ...group, start };
    groundIndex.set(terrain.groundIndex.subarray(group.start, group.start + group.count), start);
    start += group.count;

    return next;
  });

  return { groundGroups, groundIndex };
};
