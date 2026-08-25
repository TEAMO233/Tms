package com.admin.common.task;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StatisticsFlowAsyncTest {

    @Test
    void currentShanghaiHourUsesPanelTimezoneInsteadOfServerDefaultTimezone() {
        Instant utcNow = Instant.parse("2026-08-24T16:30:00Z");

        LocalDateTime hour = StatisticsFlowAsync.currentShanghaiHour(utcNow);

        assertEquals(LocalDateTime.of(2026, 8, 25, 0, 0), hour);
    }

    @Test
    void shanghaiHourMillisPointsAtBucketStartInstant() {
        LocalDateTime shanghaiHour = LocalDateTime.of(2026, 8, 25, 0, 0);

        long epochMillis = StatisticsFlowAsync.toEpochMillis(shanghaiHour);

        assertEquals(Instant.parse("2026-08-24T16:00:00Z").toEpochMilli(), epochMillis);
    }
}
