import {
  createBusinessCalendar,
  type IBusinessCalendar,
} from './businessCalendar';
import { RU_BUSINESS_CALENDAR_YEARS } from './ruBusinessCalendarData';

export const RU_BUSINESS_CALENDAR: IBusinessCalendar = createBusinessCalendar(RU_BUSINESS_CALENDAR_YEARS);
