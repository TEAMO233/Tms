import assert from 'node:assert/strict';
import {
  buildFlowStatisticsRange,
  createLastDaysRange,
  createTodayRange,
  toFlowChartData,
  toLocalDateInputValue,
} from './dashboard-flow.ts';

const now = new Date(2026, 7, 25, 10, 30, 15, 250);

assert.equal(toLocalDateInputValue(now), '2026-08-25');

assert.deepEqual(createTodayRange(now), {
  startDate: '2026-08-25',
  endDate: '2026-08-25',
});

assert.deepEqual(createLastDaysRange(7, now), {
  startDate: '2026-08-19',
  endDate: '2026-08-25',
});

const todayRange = buildFlowStatisticsRange('2026-08-25', '2026-08-25', now);
assert.equal(todayRange.startTime, new Date(2026, 7, 25, 0, 0, 0, 0).getTime());
assert.equal(todayRange.endTime, now.getTime(), '当天结束日期应该查到当前时刻,不要画未来小时');

const pastRange = buildFlowStatisticsRange('2026-08-20', '2026-08-21', now);
assert.equal(pastRange.startTime, new Date(2026, 7, 20, 0, 0, 0, 0).getTime());
assert.equal(pastRange.endTime, new Date(2026, 7, 21, 23, 59, 59, 999).getTime());

assert.throws(
  () => buildFlowStatisticsRange('2026-08-22', '2026-08-21', now),
  /开始日期不能晚于结束日期/,
);

assert.deepEqual(
  toFlowChartData([
    { label: '00:00', flow: 3072, uploadFlow: 1024, downloadFlow: 2048 },
    { label: '01:00', uploadFlow: 512, downloadFlow: 256 },
    { label: '02:00' },
  ]),
  [
    { time: '00:00', flow: 3072, uploadFlow: 1024, downloadFlow: 2048 },
    { time: '01:00', flow: 768, uploadFlow: 512, downloadFlow: 256 },
    { time: '02:00', flow: 0, uploadFlow: 0, downloadFlow: 0 },
  ],
);

console.log('dashboard flow date helpers: ok');
