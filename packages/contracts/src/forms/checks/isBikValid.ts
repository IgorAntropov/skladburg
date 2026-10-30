const BIK_PATTERN = /^04[0-9]{7}$/;

export const isBikValid = (value: string): boolean => BIK_PATTERN.test(value);
