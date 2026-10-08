export const cn = (...parts: readonly (false | null | string | undefined)[]): string => {
  return parts.filter(part => typeof part === 'string' && part !== '').join(' ');
};
