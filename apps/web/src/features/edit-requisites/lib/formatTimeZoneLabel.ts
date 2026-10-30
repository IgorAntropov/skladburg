import { getOffsetLabel } from '@/shared/i18n';

export const formatTimeZoneLabel = (timeZone: string): string => getOffsetLabel(timeZone, Date.now());
