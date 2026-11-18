export const LAYOUT_CHANNEL_PREFIX = 'layout';

export const layoutChannel = (warehouseId: string): string => `${LAYOUT_CHANNEL_PREFIX}:${warehouseId}`;
