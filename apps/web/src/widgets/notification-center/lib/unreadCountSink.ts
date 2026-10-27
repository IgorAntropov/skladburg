import {
  createContext,
  use,
} from 'react';

export type ReportUnreadCountFunction = (count: number) => void;

const reportWithoutSink: ReportUnreadCountFunction = () => undefined;

export const UnreadCountSinkContext = createContext<ReportUnreadCountFunction>(reportWithoutSink);

export const useReportUnreadCount = (): ReportUnreadCountFunction => use(UnreadCountSinkContext);
