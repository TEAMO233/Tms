package com.admin.common.task;

import com.admin.entity.StatisticsFlow;
import com.admin.entity.User;
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

    @Test
    void buildStatisticsFlowStoresUploadAndDownloadIncrementsSeparately() {
        User user = user(42L, 500L, 120L);
        StatisticsFlow last = lastTotals(200L, 100L);

        StatisticsFlow snapshot = StatisticsFlowAsync.buildStatisticsFlow(user, last, 12345L, "00:00");

        assertEquals(42L, snapshot.getUserId());
        assertEquals(300L, snapshot.getInFlow());
        assertEquals(20L, snapshot.getOutFlow());
        assertEquals(320L, snapshot.getFlow());
        assertEquals(500L, snapshot.getTotalInFlow());
        assertEquals(120L, snapshot.getTotalOutFlow());
        assertEquals(620L, snapshot.getTotalFlow());
        assertEquals(12345L, snapshot.getCreatedTime());
        assertEquals("00:00", snapshot.getTime());
    }

    @Test
    void buildStatisticsFlowTreatsDirectionCounterResetAsCurrentDirectionTotal() {
        User user = user(42L, 50L, 20L);
        StatisticsFlow last = lastTotals(200L, 300L);

        StatisticsFlow snapshot = StatisticsFlowAsync.buildStatisticsFlow(user, last, 12345L, "00:00");

        assertEquals(50L, snapshot.getInFlow());
        assertEquals(20L, snapshot.getOutFlow());
        assertEquals(70L, snapshot.getFlow());
        assertEquals(50L, snapshot.getTotalInFlow());
        assertEquals(20L, snapshot.getTotalOutFlow());
        assertEquals(70L, snapshot.getTotalFlow());
    }

    private static User user(Long id, Long downloadBytes, Long uploadBytes) {
        User user = new User();
        user.setId(id);
        user.setInFlow(downloadBytes);
        user.setOutFlow(uploadBytes);
        return user;
    }

    private static StatisticsFlow lastTotals(Long downloadBytes, Long uploadBytes) {
        StatisticsFlow flow = new StatisticsFlow();
        flow.setTotalInFlow(downloadBytes);
        flow.setTotalOutFlow(uploadBytes);
        flow.setTotalFlow(downloadBytes + uploadBytes);
        return flow;
    }
}
