export const splitMarkingCodes = (value: string): string[] => value.trim().split(/\s+/u).filter(code => code !== '');
