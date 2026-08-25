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
    void sameDayRangeUsesHourlyBucketsAndFillsMissingHoursWithUploadAndDownloadBreakdown() {
        StatisticsFlowServiceImpl service = new StatisticsFlowServiceImpl();
        long start = millis(2026, 8, 25, 0, 0);
        long end = millis(2026, 8, 25, 3, 30);
        List<StatisticsFlow> records = Arrays.asList(
                flow(start, 80L, 20L),
                flow(millis(2026, 8, 25, 2, 0), 200L, 50L)
        );

        FlowStatisticsResultDto result = service.buildStatisticsResult(records, start, end);

        assertEquals("hour", result.getGranularity());
        assertEquals(350L, result.getTotalFlow());
        assertEquals(280L, result.getDownloadFlow());
        assertEquals(70L, result.getUploadFlow());
        assertEquals(Arrays.asList("00:00", "01:00", "02:00", "03:00"), labels(result));
        assertEquals(Arrays.asList(100L, 0L, 250L, 0L), flows(result));
        assertEquals(Arrays.asList(80L, 0L, 200L, 0L), downloadFlows(result));
        assertEquals(Arrays.asList(20L, 0L, 50L, 0L), uploadFlows(result));
    }

    @Test
    void multiDayRangeUsesDailyBucketsAndSumsUploadAndDownloadByLocalDate() {
        StatisticsFlowServiceImpl service = new StatisticsFlowServiceImpl();
        long start = millis(2026, 8, 23, 0, 0);
        long end = millis(2026, 8, 25, 10, 0);
        List<StatisticsFlow> records = Arrays.asList(
                flow(millis(2026, 8, 23, 8, 0), 40L, 10L),
                flow(millis(2026, 8, 24, 1, 0), 50L, 20L),
                flow(millis(2026, 8, 24, 23, 0), 25L, 5L),
                flow(millis(2026, 8, 25, 9, 0), 15L, 5L)
        );

        FlowStatisticsResultDto result = service.buildStatisticsResult(records, start, end);

        assertEquals("day", result.getGranularity());
        assertEquals(170L, result.getTotalFlow());
        assertEquals(130L, result.getDownloadFlow());
        assertEquals(40L, result.getUploadFlow());
        assertEquals(Arrays.asList("08-23", "08-24", "08-25"), labels(result));
        assertEquals(Arrays.asList(50L, 100L, 20L), flows(result));
        assertEquals(Arrays.asList(40L, 75L, 15L), downloadFlows(result));
        assertEquals(Arrays.asList(10L, 25L, 5L), uploadFlows(result));
    }

    private static StatisticsFlow flow(long createdTime, long downloadBytes, long uploadBytes) {
        StatisticsFlow flow = new StatisticsFlow();
        flow.setCreatedTime(createdTime);
        flow.setInFlow(downloadBytes);
        flow.setOutFlow(uploadBytes);
        flow.setFlow(downloadBytes + uploadBytes);
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

    private static List<Long> downloadFlows(FlowStatisticsResultDto result) {
        return result.getPoints().stream().map(FlowStatisticsResultDto.Point::getDownloadFlow).collect(Collectors.toList());
    }

    private static List<Long> uploadFlows(FlowStatisticsResultDto result) {
        return result.getPoints().stream().map(FlowStatisticsResultDto.Point::getUploadFlow).collect(Collectors.toList());
    }
}
