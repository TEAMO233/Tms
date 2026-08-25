export interface FlowStatisticsDateRange {
  startDate: string;
  endDate: string;
}

export interface FlowStatisticsQueryRange {
  startTime: number;
  endTime: number;
}

export interface FlowStatisticsPointLike {
  label: string;
  flow?: number;
  downloadFlow?: number;
  uploadFlow?: number;
}

export interface FlowChartPoint {
  time: string;
  flow: number;
  downloadFlow: number;
  uploadFlow: number;
}

const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const toLocalDateInputValue = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const createTodayRange = (now: Date = new Date()): FlowStatisticsDateRange => {
  const today = toLocalDateInputValue(now);

  return { startDate: today, endDate: today };
};

export const createLastDaysRange = (
  days: number,
  now: Date = new Date(),
): FlowStatisticsDateRange => {
  const safeDays = Math.max(1, Math.floor(days));
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - safeDays + 1);

  return {
    startDate: toLocalDateInputValue(start),
    endDate: toLocalDateInputValue(now),
  };
};

const parseLocalDate = (value: string, endOfDay = false): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');

  if (!match) {
    throw new Error('请选择有效日期');
  }

  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error('请选择有效日期');
  }

  return date;
};

export const buildFlowStatisticsRange = (
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): FlowStatisticsQueryRange => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate, true);

  if (start.getTime() > end.getTime()) {
    throw new Error('开始日期不能晚于结束日期');
  }

  const today = toLocalDateInputValue(now);
  const endTime = endDate === today ? now.getTime() : Math.min(end.getTime(), now.getTime());

  return {
    startTime: start.getTime(),
    endTime,
  };
};

const safeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const toFlowChartData = (points: FlowStatisticsPointLike[] = []): FlowChartPoint[] =>
  points.map((point) => {
    const downloadFlow = safeNumber(point.downloadFlow);
    const uploadFlow = safeNumber(point.uploadFlow);
    const flow = safeNumber(point.flow) || downloadFlow + uploadFlow;

    return {
      time: point.label,
      flow,
      downloadFlow,
      uploadFlow,
    };
  });
