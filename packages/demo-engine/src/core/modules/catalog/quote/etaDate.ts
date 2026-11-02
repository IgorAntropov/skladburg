import type {
  CalendarDateValue,
  IBusinessCalendar,
} from '../../../calendar/index';

import {
  addCalendarDays,
  BusinessCalendarRangeError,
  toCalendarDate,
} from '../../../calendar/index';

export const MAX_DRIVE_MINUTES_PER_DAY = 540;

export interface EtaDateInputValue {
  calendar: IBusinessCalendar;
  driveMinutes: number;
  preparationWorkingDays: number;
  timeZone: string;
  worldTimeMs: number;
}

const toWorkingDayOnOrAfter = (calendar: IBusinessCalendar, date: CalendarDateValue): CalendarDateValue =>
  calendar.isWorkingDay(date) ? date : calendar.addWorkingDays(date, 1);

export const computeEtaDate = (input: EtaDateInputValue): CalendarDateValue | undefined => {
  const { calendar, driveMinutes, preparationWorkingDays, timeZone, worldTimeMs } = input;

  try {
    const start = toWorkingDayOnOrAfter(calendar, toCalendarDate(worldTimeMs, timeZone));
    const ready = calendar.addWorkingDays(start, preparationWorkingDays);
    const driveDays = Math.max(0, Math.ceil(driveMinutes / MAX_DRIVE_MINUTES_PER_DAY) - 1);

    return toWorkingDayOnOrAfter(calendar, addCalendarDays(ready, driveDays));
  }
  catch (error) {
    if (error instanceof BusinessCalendarRangeError) {
      return undefined;
    }

    throw error;
  }
};
