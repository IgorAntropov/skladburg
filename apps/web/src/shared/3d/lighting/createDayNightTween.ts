export interface DayNightTweenOptionsValue {
  durationMs: number;
  initialValue: number;
}

export interface IDayNightTween {
  advance: (nowMs: number) => boolean;
  setTarget: (target: 0 | 1, nowMs: number, isInstant: boolean) => void;
  readonly value: number;
}

const smoothstep = (progress: number): number => {
  return progress * progress * (3 - 2 * progress);
};

export const createDayNightTween = (options: DayNightTweenOptionsValue): IDayNightTween => {
  let value = options.initialValue;
  let target = options.initialValue;
  let fromValue = options.initialValue;
  let startMs = 0;
  let pathDurationMs = 0;
  let isMoving = false;

  const setTarget = (nextTarget: 0 | 1, nowMs: number, isInstant: boolean): void => {
    if (isInstant) {
      value = nextTarget;
      target = nextTarget;
      isMoving = false;

      return;
    }

    if (nextTarget === target && (isMoving || value === nextTarget)) {
      return;
    }

    target = nextTarget;
    fromValue = value;
    startMs = nowMs;
    pathDurationMs = options.durationMs * Math.abs(nextTarget - value);
    isMoving = true;
  };

  const advance = (nowMs: number): boolean => {
    if (!isMoving) {
      return false;
    }

    const progress = pathDurationMs > 0 ? Math.min(1, Math.max(0, (nowMs - startMs) / pathDurationMs)) : 1;

    if (progress >= 1) {
      value = target;
      isMoving = false;

      return false;
    }

    value = fromValue + (target - fromValue) * smoothstep(progress);

    return true;
  };

  return {
    advance,
    setTarget,
    get value(): number {
      return value;
    },
  };
};
