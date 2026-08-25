package com.admin.service.impl;

import com.admin.common.dto.FlowStatisticsResultDto;
import com.admin.entity.StatisticsFlow;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StatisticsFlowServiceImplTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    @Test
    void sameDayRangeUsesHourlyBucketsAndFillsMissingHours() {
        StatisticsFlowServiceImpl service = new StatisticsFlowServiceImpl();
        long start = millis(2026, 8, 25, 0, 0);
        long end = millis(2026, 8, 25, 3, 30);
        List<StatisticsFlow> records = Arrays.asList(
                flow(start, 100L),
                flow(millis(2026, 8, 25, 2, 0), 250L)
        );

        FlowStatisticsResultDto result = service.buildStatisticsResult(records, start, end);

        assertEquals("hour", result.getGranularity());
        assertEquals(350L, result.getTotalFlow());
        assertEquals(Arrays.asList("00:00", "01:00", "02:00", "03:00"), labels(result));
        assertEquals(Arrays.asList(100L, 0L, 250L, 0L), flows(result));
    }

    @Test
    void multiDayRangeUsesDailyBucketsAndSumsRecordsByLocalDate() {
        StatisticsFlowServiceImpl service = new StatisticsFlowServiceImpl();
        long start = millis(2026, 8, 23, 0, 0);
        long end = millis(2026, 8, 25, 10, 0);
        List<StatisticsFlow> records = Arrays.asList(
                flow(millis(2026, 8, 23, 8, 0), 50L),
                flow(millis(2026, 8, 24, 1, 0), 70L),
                flow(millis(2026, 8, 24, 23, 0), 30L),
                flow(millis(2026, 8, 25, 9, 0), 20L)
        );

        FlowStatisticsResultDto result = service.buildStatisticsResult(records, start, end);

        assertEquals("day", result.getGranularity());
        assertEquals(170L, result.getTotalFlow());
        assertEquals(Arrays.asList("08-23", "08-24", "08-25"), labels(result));
        assertEquals(Arrays.asList(50L, 100L, 20L), flows(result));
    }

    private static StatisticsFlow flow(long createdTime, long bytes) {
        StatisticsFlow flow = new StatisticsFlow();
        flow.setCreatedTime(createdTime);
        flow.setFlow(bytes);
        return flow;
    }

    private static long millis(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute).atZone(ZONE).toInstant().toEpochMilli();
    }

    private static List<String> labels(FlowStatisticsResultDto result) {
        return result.getPoints().stream().map(FlowStatisticsResultDto.Point::getLabel).collect(Collectors.toList());
    }

    private static List<Long> flows(FlowStatisticsResultDto result) {
        return result.getPoints().stream().map(FlowStatisticsResultDto.Point::getFlow).collect(Collectors.toList());
    }
}
