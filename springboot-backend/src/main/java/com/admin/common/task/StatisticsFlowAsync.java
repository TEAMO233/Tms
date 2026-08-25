package com.admin.common.task;

import com.admin.entity.StatisticsFlow;
import com.admin.entity.User;
import com.admin.service.StatisticsFlowService;
import com.admin.service.UserService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import javax.annotation.Resource;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Slf4j
@Configuration
@EnableScheduling
public class StatisticsFlowAsync {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter HOUR_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    /** 按小时落库后支持仪表板自定义时间段查询,保留一年左右的历史。 */
    private static final long RETENTION_DAYS = 366L;

    @Resource
    UserService userService;

    @Resource
    StatisticsFlowService statisticsFlowService;

    @Scheduled(cron = "0 0 * * * ?")
    public void statistics_flow() {
        LocalDateTime currentHour = currentShanghaiHour(Instant.now());
        String hourString = currentHour.format(HOUR_FORMATTER);
        long time = toEpochMillis(currentHour);

        // 删除保留期之前的数据。旧版只保留48小时,无法支持按天和自定义时间段查询。
        long nowMs = new Date().getTime();
        long cutoffMs = nowMs - RETENTION_DAYS * 24L * 60 * 60 * 1000;
        statisticsFlowService.remove(
                new LambdaQueryWrapper<StatisticsFlow>()
                        .lt(StatisticsFlow::getCreatedTime, cutoffMs)
        );

        List<User> list = userService.list();
        List<StatisticsFlow> statisticsFlowList = new ArrayList<>();

        for (User user : list) {
            // 从数据库获取上一次记录
            StatisticsFlow lastFlowRecord = statisticsFlowService.getOne(
                    new LambdaQueryWrapper<StatisticsFlow>()
                            .eq(StatisticsFlow::getUserId, user.getId())
                            .orderByDesc(StatisticsFlow::getId)
                            .last("LIMIT 1")
            );

            statisticsFlowList.add(buildStatisticsFlow(user, lastFlowRecord, time, hourString));
        }

        statisticsFlowService.saveBatch(statisticsFlowList);
    }

    static StatisticsFlow buildStatisticsFlow(User user, StatisticsFlow lastFlowRecord, long time, String hourString) {
        long currentInFlow = safe(user.getInFlow());
        long currentOutFlow = safe(user.getOutFlow());
        long currentTotalFlow = currentInFlow + currentOutFlow;

        boolean hasDirectionBaseline = lastFlowRecord == null
                || (lastFlowRecord.getTotalInFlow() != null && lastFlowRecord.getTotalOutFlow() != null);

        long incrementInFlow;
        long incrementOutFlow;
        long incrementFlow;
        if (lastFlowRecord == null) {
            incrementInFlow = currentInFlow;
            incrementOutFlow = currentOutFlow;
            incrementFlow = currentTotalFlow;
        } else if (hasDirectionBaseline) {
            incrementInFlow = incrementFromCounter(currentInFlow, lastFlowRecord.getTotalInFlow());
            incrementOutFlow = incrementFromCounter(currentOutFlow, lastFlowRecord.getTotalOutFlow());
            incrementFlow = incrementInFlow + incrementOutFlow;
        } else {
            // 老版本快照只有 total_flow,没有分方向累计值。首次升级后的一个整点无法准确拆分方向,
            // 因此沿用 total_flow 计算总量,并把当前方向累计值写入本次快照作为下一小时的基线。
            long lastTotalFlow = safe(lastFlowRecord.getTotalFlow());
            incrementFlow = currentTotalFlow - lastTotalFlow;
            if (incrementFlow < 0) {
                incrementFlow = currentTotalFlow;
            }
            incrementInFlow = 0L;
            incrementOutFlow = 0L;
        }

        StatisticsFlow statisticsFlow = new StatisticsFlow();
        statisticsFlow.setUserId(user.getId());
        statisticsFlow.setFlow(incrementFlow);
        statisticsFlow.setInFlow(incrementInFlow);
        statisticsFlow.setOutFlow(incrementOutFlow);
        statisticsFlow.setTotalFlow(currentTotalFlow);
        statisticsFlow.setTotalInFlow(currentInFlow);
        statisticsFlow.setTotalOutFlow(currentOutFlow);
        statisticsFlow.setTime(hourString);
        statisticsFlow.setCreatedTime(time);
        return statisticsFlow;
    }

    static LocalDateTime currentShanghaiHour(Instant now) {
        return LocalDateTime.ofInstant(now, ZONE).withMinute(0).withSecond(0).withNano(0);
    }

    static long toEpochMillis(LocalDateTime time) {
        return time.atZone(ZONE).toInstant().toEpochMilli();
    }

    private static long incrementFromCounter(long current, Long previous) {
        long prev = safe(previous);
        long increment = current - prev;
        return increment < 0 ? current : increment;
    }

    private static long safe(Long value) {
        return value == null ? 0L : value;
    }
}
