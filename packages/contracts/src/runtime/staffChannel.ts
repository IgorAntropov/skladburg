export const STAFF_CHANNEL_PREFIX = 'staff';

export const staffChannel = (warehouseId: string): string => `${STAFF_CHANNEL_PREFIX}:${warehouseId}`;
