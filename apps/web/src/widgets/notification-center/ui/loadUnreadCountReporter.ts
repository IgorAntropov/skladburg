type UnreadCountReporterModuleValue = typeof import('./reporter/UnreadCountReporterBody');

export const loadUnreadCountReporter = (): Promise<UnreadCountReporterModuleValue> => import('./reporter/UnreadCountReporterBody');
