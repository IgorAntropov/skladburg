const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const readPrefersReducedMotion = (): boolean => {
  const matchMedia: unknown = Reflect.get(globalThis, 'matchMedia');

  return typeof matchMedia === 'function' && globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;
};
