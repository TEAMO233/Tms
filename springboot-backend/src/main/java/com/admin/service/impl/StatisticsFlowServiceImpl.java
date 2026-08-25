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
        Map<LocalDateTime, Long> flowByHour = new LinkedHashMap<>();
        LocalDateTime cursor = start;
        while (!cursor.isAfter(end)) {
            flowByHour.put(cursor, 0L);
            cursor = cursor.plusHours(1);
        }

        if (records != null) {
            for (StatisticsFlow record : records) {
                if (record == null || record.getCreatedTime() == null) {
                    continue;
                }
                LocalDateTime hour = toLocalDateTime(record.getCreatedTime()).truncatedTo(ChronoUnit.HOURS);
                if (flowByHour.containsKey(hour)) {
                    flowByHour.put(hour, flowByHour.get(hour) + safeFlow(record));
                }
            }
        }

        long total = 0L;
        for (Map.Entry<LocalDateTime, Long> entry : flowByHour.entrySet()) {
            LocalDateTime bucketStart = entry.getKey();
            LocalDateTime bucketEnd = bucketStart.plusHours(1).minusNanos(1);
            long flow = entry.getValue();
            total += flow;
            result.getPoints().add(new FlowStatisticsResultDto.Point(
                    bucketStart.format(HOUR_LABEL),
                    toMillis(bucketStart),
                    toMillis(bucketEnd),
                    flow
            ));
        }
        result.setTotalFlow(total);
    }

    private void fillDailyResult(FlowStatisticsResultDto result, List<StatisticsFlow> records,
                                 LocalDate startDate, LocalDate endDate) {
        Map<LocalDate, Long> flowByDay = new LinkedHashMap<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            flowByDay.put(cursor, 0L);
            cursor = cursor.plusDays(1);
        }

        if (records != null) {
            for (StatisticsFlow record : records) {
                if (record == null || record.getCreatedTime() == null) {
                    continue;
                }
                LocalDate day = toLocalDateTime(record.getCreatedTime()).toLocalDate();
                if (flowByDay.containsKey(day)) {
                    flowByDay.put(day, flowByDay.get(day) + safeFlow(record));
                }
            }
        }

        long total = 0L;
        for (Map.Entry<LocalDate, Long> entry : flowByDay.entrySet()) {
            LocalDate day = entry.getKey();
            LocalDateTime bucketStart = day.atStartOfDay();
            LocalDateTime bucketEnd = day.plusDays(1).atStartOfDay().minusNanos(1);
            long flow = entry.getValue();
            total += flow;
            result.getPoints().add(new FlowStatisticsResultDto.Point(
                    day.format(DAY_LABEL),
                    toMillis(bucketStart),
                    toMillis(bucketEnd),
                    flow
            ));
        }
        result.setTotalFlow(total);
    }

    private long safeFlow(StatisticsFlow flow) {
        return flow.getFlow() == null ? 0L : flow.getFlow();
    }

    private LocalDateTime toLocalDateTime(long epochMs) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMs), ZONE);
    }

    private long toMillis(LocalDateTime time) {
        return time.atZone(ZONE).toInstant().toEpochMilli();
    }
}
