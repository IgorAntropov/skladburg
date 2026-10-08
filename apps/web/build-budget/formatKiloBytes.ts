import { BYTES_PER_KILOBYTE } from './bundleBudgetConstants.ts';

export const toKiloBytes = (bytes: number): number => Number((bytes / BYTES_PER_KILOBYTE).toFixed(2));

export const formatKiloBytes = (bytes: number): string => `${(bytes / BYTES_PER_KILOBYTE).toFixed(2)} kB`;
