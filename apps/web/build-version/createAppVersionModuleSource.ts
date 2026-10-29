export const createAppVersionModuleSource = (appVersion: string): string => `export const appVersion = ${JSON.stringify(appVersion)};\n`;
