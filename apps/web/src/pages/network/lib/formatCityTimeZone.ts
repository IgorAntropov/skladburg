import { getOffsetLabel } from '@/shared/i18n';

export const formatCityTimeZone = (timeZone: string, instant: Date | number = Date.now()): string => getOffsetLabel(timeZone, instant);
