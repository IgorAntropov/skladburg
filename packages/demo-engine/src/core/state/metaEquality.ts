import type {
  EngineMetaValue,
  RandomStateValue,
} from '../ports/index';

type NumericRecordValue = Readonly<Record<string, bigint | number>>;

const isSameNumericRecord = (current: NumericRecordValue, next: NumericRecordValue): boolean => {
  const currentKeys = Object.keys(current);

  return currentKeys.length === Object.keys(next).length
    && currentKeys.every(key => Object.hasOwn(next, key) && current[key] === next[key]);
};

const isSameRandomState = (current: RandomStateValue, next: RandomStateValue): boolean =>
  current.a === next.a && current.b === next.b && current.c === next.c && current.d === next.d;

export const isSameMeta = (current: EngineMetaValue, next: EngineMetaValue): boolean =>
  current.seedVersion === next.seedVersion
  && current.timeScale === next.timeScale
  && current.worldTimeMs === next.worldTimeMs
  && isSameRandomState(current.randomState, next.randomState)
  && isSameRandomState(current.traceRandomState, next.traceRandomState)
  && isSameNumericRecord(current.channelSeq, next.channelSeq)
  && isSameNumericRecord(current.schedulerDueAtMs, next.schedulerDueAtMs);
