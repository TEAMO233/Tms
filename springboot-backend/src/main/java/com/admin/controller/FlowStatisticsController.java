package com.admin.controller;

import com.admin.common.dto.FlowStatisticsQueryDto;
import com.admin.common.lang.R;
import com.admin.common.utils.JwtUtil;
import com.admin.service.StatisticsFlowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/flow-statistics")
public class FlowStatisticsController {

    @Autowired
    private StatisticsFlowService statisticsFlowService;

    /**
     * 查询当前登录用户的流量统计。
     * 同一天按小时补点,跨天按自然日汇总。
     */
    @PostMapping("/range")
    public R range(@RequestBody FlowStatisticsQueryDto queryDto) {
        Integer userId = JwtUtil.getUserIdFromToken();
        if (userId == null) {
            return R.err("未登录");
        }
        if (queryDto == null) {
            return R.err("查询时间不能为空");
        }
        return statisticsFlowService.queryRange(userId.longValue(), queryDto.getStartTime(), queryDto.getEndTime());
    }
}
