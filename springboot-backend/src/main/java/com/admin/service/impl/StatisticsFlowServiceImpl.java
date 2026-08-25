package com.admin.service.impl;

import com.admin.common.dto.FlowStatisticsResultDto;
import com.admin.common.lang.R;
import com.admin.entity.StatisticsFlow;
import com.admin.mapper.StatisticsFlowMapper;
import com.admin.service.StatisticsFlowService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * <p>
 *  服务实现类
 * </p>
 *
 * @author QAQ
 * @since 2025-08-14
 */
@Service
public class StatisticsFlowServiceImpl extends ServiceImpl<StatisticsFlowMapper, StatisticsFlow> implements StatisticsFlowService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter HOUR_LABEL = DateTimeFormatter.ofPattern("HH:00");
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("MM-dd");
    private static final long MAX_RANGE_DAYS = 366L;

    @Override
    public R queryRange(Long userId, Long startTime, Long endTime) {
        if (userId == null) {
            return R.err("用户不能为空");
        }
        if (startTime == null || endTime == null) {
            return R.err("查询时间不能为空");
        }
        if (startTime > endTime) {
            return R.err("开始时间不能晚于结束时间");
        }
        long maxRangeMs = MAX_RANGE_DAYS * 24L * 60L * 60L * 1000L;
        if (endTime - startTime > maxRangeMs) {
            return R.err("单次最多查询" + MAX_RANGE_DAYS + "天");
        }

        List<StatisticsFlow> records = this.list(
                new LambdaQueryWrapper<StatisticsFlow>()
                        .eq(StatisticsFlow::getUserId, userId)
                        .ge(StatisticsFlow::getCreatedTime, startTime)
                        .le(StatisticsFlow::getCreatedTime, endTime)
                        .orderByAsc(StatisticsFlow::getCreatedTime)
        );

        return R.ok(buildStatisticsResult(records, startTime, endTime));
    }

    FlowStatisticsResultDto buildStatisticsResult(List<StatisticsFlow> records, long startTime, long endTime) {
        LocalDateTime start = toLocalDateTime(startTime).truncatedTo(ChronoUnit.HOURS);
        LocalDateTime end = toLocalDateTime(endTime).truncatedTo(ChronoUnit.HOURS);
        LocalDate startDate = start.toLocalDate();
        LocalDate endDate = toLocalDateTime(endTime).toLocalDate();

        FlowStatisticsResultDto result = new FlowStatisticsResultDto();
        result.setStartTime(startTime);
        result.setEndTime(endTime);

        boolean sameDay = startDate.equals(endDate);
        result.setGranularity(sameDay ? "hour" : "day");

        if (sameDay) {
            fillHourlyResult(result, records, start, end);
        } else {
            fillDailyResult(result, records, startDate, endDate);
        }
        return result;
    }

    private void fillHourlyResult(FlowStatisticsResultDto result, List<StatisticsFlow> records,
                                  LocalDateTime start, LocalDateTime end) {
        Map<LocalDateTime, FlowBucket> flowByHour = new LinkedHashMap<>();
        LocalDateTime cursor = start;
        while (!cursor.isAfter(end)) {
            flowByHour.put(cursor, new FlowBucket());
            cursor = cursor.plusHours(1);
        }

        if (records != null) {
            for (StatisticsFlow record : records) {
                if (record == null || record.getCreatedTime() == null) {
                    continue;
                }
                LocalDateTime hour = toLocalDateTime(record.getCreatedTime()).truncatedTo(ChronoUnit.HOURS);
                FlowBucket bucket = flowByHour.get(hour);
                if (bucket != null) {
                    bucket.add(record);
                }
            }
        }

        FlowBucket total = new FlowBucket();
        for (Map.Entry<LocalDateTime, FlowBucket> entry : flowByHour.entrySet()) {
            LocalDateTime bucketStart = entry.getKey();
            LocalDateTime bucketEnd = bucketStart.plusHours(1).minusNanos(1);
            FlowBucket bucket = entry.getValue();
            total.add(bucket);
            result.getPoints().add(new FlowStatisticsResultDto.Point(
                    bucketStart.format(HOUR_LABEL),
                    toMillis(bucketStart),
                    toMillis(bucketEnd),
                    bucket.flow,
                    bucket.downloadFlow,
                    bucket.uploadFlow
            ));
        }
        applyTotals(result, total);
    }

    private void fillDailyResult(FlowStatisticsResultDto result, List<StatisticsFlow> records,
                                 LocalDate startDate, LocalDate endDate) {
        Map<LocalDate, FlowBucket> flowByDay = new LinkedHashMap<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            flowByDay.put(cursor, new FlowBucket());
            cursor = cursor.plusDays(1);
        }

        if (records != null) {
            for (StatisticsFlow record : records) {
                if (record == null || record.getCreatedTime() == null) {
                    continue;
                }
                LocalDate day = toLocalDateTime(record.getCreatedTime()).toLocalDate();
                FlowBucket bucket = flowByDay.get(day);
                if (bucket != null) {
                    bucket.add(record);
                }
            }
        }

        FlowBucket total = new FlowBucket();
        for (Map.Entry<LocalDate, FlowBucket> entry : flowByDay.entrySet()) {
            LocalDate day = entry.getKey();
            LocalDateTime bucketStart = day.atStartOfDay();
            LocalDateTime bucketEnd = day.plusDays(1).atStartOfDay().minusNanos(1);
            FlowBucket bucket = entry.getValue();
            total.add(bucket);
            result.getPoints().add(new FlowStatisticsResultDto.Point(
                    day.format(DAY_LABEL),
                    toMillis(bucketStart),
                    toMillis(bucketEnd),
                    bucket.flow,
                    bucket.downloadFlow,
                    bucket.uploadFlow
            ));
        }
        applyTotals(result, total);
    }

    private void applyTotals(FlowStatisticsResultDto result, FlowBucket total) {
        result.setTotalFlow(total.flow);
        result.setDownloadFlow(total.downloadFlow);
        result.setUploadFlow(total.uploadFlow);
    }

    private long safeFlow(StatisticsFlow flow) {
        if (flow.getFlow() != null) {
            return flow.getFlow();
        }
        return safeDownloadFlow(flow) + safeUploadFlow(flow);
    }

    private long safeDownloadFlow(StatisticsFlow flow) {
        return flow.getInFlow() == null ? 0L : flow.getInFlow();
    }

    private long safeUploadFlow(StatisticsFlow flow) {
        return flow.getOutFlow() == null ? 0L : flow.getOutFlow();
    }

    private LocalDateTime toLocalDateTime(long epochMs) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMs), ZONE);
    }

    private long toMillis(LocalDateTime time) {
        return time.atZone(ZONE).toInstant().toEpochMilli();
    }

    private class FlowBucket {
        private long flow;
        private long downloadFlow;
        private long uploadFlow;

        private void add(StatisticsFlow record) {
            this.flow += safeFlow(record);
            this.downloadFlow += safeDownloadFlow(record);
            this.uploadFlow += safeUploadFlow(record);
        }

        private void add(FlowBucket bucket) {
            this.flow += bucket.flow;
            this.downloadFlow += bucket.downloadFlow;
            this.uploadFlow += bucket.uploadFlow;
        }
    }
}
