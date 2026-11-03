const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const resolveScrollBehavior = (): ScrollBehavior => {
  const matchMedia: unknown = Reflect.get(globalThis, 'matchMedia');
  const isReduced = typeof matchMedia === 'function' && globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;

  return isReduced ? 'auto' : 'smooth';
};
