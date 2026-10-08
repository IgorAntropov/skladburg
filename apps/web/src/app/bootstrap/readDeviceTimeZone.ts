const FALLBACK_TIME_ZONE = 'UTC';

export const readDeviceTimeZone = (): string => {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

  return timeZone === '' ? FALLBACK_TIME_ZONE : timeZone;
};
