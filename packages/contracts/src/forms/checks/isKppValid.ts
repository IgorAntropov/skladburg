const KPP_PATTERN = /^[0-9]{4}[0-9A-Z]{2}[0-9]{3}$/;

export const isKppValid = (value: string): boolean => KPP_PATTERN.test(value);
