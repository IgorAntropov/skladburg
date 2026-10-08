import {
  type CalendarDateValue,
  toEpochDay,
} from './calendarDate';

interface ZonedClockReadingValue {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

const CLOCK_PART_TYPES = ['day', 'hour', 'minute', 'month', 'second', 'year'] as const;

type ClockPartType = (typeof CLOCK_PART_TYPES)[number];

const isClockPartType = (type: string): type is ClockPartType => CLOCK_PART_TYPES.some(item => item === type);

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 86_400_000;
const SEARCH_HALF_WINDOW_MS = 2 * MILLISECONDS_PER_DAY;

const formatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatterByTimeZone.get(timeZone);

  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    minute: 'numeric',
    month: 'numeric',
    second: 'numeric',
    timeZone,
    year: 'numeric',
  });

  formatterByTimeZone.set(timeZone, formatter);

  return formatter;
};

const assertFiniteInstant = (instantMs: number): void => {
  if (!Number.isFinite(instantMs)) {
    throw new RangeError(`Instant must be a finite number of milliseconds, got ${String(instantMs)}`);
  }
};

const readClock = (instantMs: number, timeZone: string): ZonedClockReadingValue => {
  assertFiniteInstant(instantMs);

  const reading: ZonedClockReadingValue = {
    day: 0,
    hour: 0,
    minute: 0,
    month: 0,
    second: 0,
    year: 0,
  };

  for (const part of getFormatter(timeZone).formatToParts(instantMs)) {
    if (isClockPartType(part.type)) {
      reading[part.type] = Number(part.value);
    }
  }

  return reading;
};

const toLocalMsAsUtc = (reading: ZonedClockReadingValue): number => {
  const date = new Date(0);

  date.setUTCFullYear(reading.year, reading.month - 1, reading.day);
  date.setUTCHours(reading.hour, reading.minute, reading.second, 0);

  return date.getTime();
};

export const getZoneOffsetMs = (instantMs: number, timeZone: string): number => {
  const wholeSecondMs = Math.floor(instantMs / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;

  return toLocalMsAsUtc(readClock(instantMs, timeZone)) - wholeSecondMs;
};

export const toCalendarDate = (instantMs: number, timeZone: string): CalendarDateValue => {
  const { day, month, year } = readClock(instantMs, timeZone);

  return { day, month, year };
};

const findFirstInstantOfDay = (localMidnightMs: number, targetEpochDay: number, timeZone: string): number => {
  const isOnOrAfterTargetDay = (instantMs: number): boolean => toEpochDay(toCalendarDate(instantMs, timeZone)) >= targetEpochDay;

  let lowSecond = Math.floor((localMidnightMs - SEARCH_HALF_WINDOW_MS) / MILLISECONDS_PER_SECOND);
  let highSecond = Math.floor((localMidnightMs + SEARCH_HALF_WINDOW_MS) / MILLISECONDS_PER_SECOND);

  while (lowSecond < highSecond) {
    const middleSecond = Math.floor((lowSecond + highSecond) / 2);

    if (isOnOrAfterTargetDay(middleSecond * MILLISECONDS_PER_SECOND)) {
      highSecond = middleSecond;
    }
    else {
      lowSecond = middleSecond + 1;
    }
  }

  return lowSecond * MILLISECONDS_PER_SECOND;
};

export const getStartOfDayInstant = (date: CalendarDateValue, timeZone: string): number => {
  const targetEpochDay = toEpochDay(date);
  const localMidnightMs = targetEpochDay * MILLISECONDS_PER_DAY;
  const candidateOffsets = [-MILLISECONDS_PER_DAY, 0, MILLISECONDS_PER_DAY].map(shiftMs =>
    getZoneOffsetMs(localMidnightMs + shiftMs, timeZone),
  );

  const validInstants = candidateOffsets
    .map(offsetMs => localMidnightMs - offsetMs)
    .filter(instantMs => getZoneOffsetMs(instantMs, timeZone) === localMidnightMs - instantMs);

  if (validInstants.length > 0) {
    return Math.min(...validInstants);
  }

  return findFirstInstantOfDay(localMidnightMs, targetEpochDay, timeZone);
};
