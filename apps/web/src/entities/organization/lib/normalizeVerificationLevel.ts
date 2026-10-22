export type VerificationLevelValue = 0 | 1 | 2 | 3 | 4;

export const MAX_VERIFICATION_LEVEL = 4;

const VERIFICATION_LEVELS = [0, 1, 2, 3, 4] as const satisfies readonly VerificationLevelValue[];

export const normalizeVerificationLevel = (level: number): VerificationLevelValue => {
  if (Number.isNaN(level)) {
    return 0;
  }

  const clamped = Math.min(Math.max(Math.trunc(level), 0), MAX_VERIFICATION_LEVEL);

  return VERIFICATION_LEVELS[clamped] ?? 0;
};
