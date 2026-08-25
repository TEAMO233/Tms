package com.admin.common.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FlowStatisticsResultDto {
    /** hour=按小时补点, day=按天汇总 */
    private String granularity;
    private Long startTime;
    private Long endTime;
    private Long totalFlow;
    private List<Point> points = new ArrayList<>();

    @Data
    public static class Point {
        private String label;
        private Long startTime;
        private Long endTime;
        private Long flow;

        public Point() {
        }

        public Point(String label, Long startTime, Long endTime, Long flow) {
            this.label = label;
            this.startTime = startTime;
            this.endTime = endTime;
            this.flow = flow;
        }
    }
}
