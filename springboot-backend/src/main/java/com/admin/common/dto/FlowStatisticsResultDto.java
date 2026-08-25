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
    /** 上传+下载合计 */
    private Long totalFlow;
    /** 下载方向合计 */
    private Long downloadFlow;
    /** 上传方向合计 */
    private Long uploadFlow;
    private List<Point> points = new ArrayList<>();

    @Data
    public static class Point {
        private String label;
        private Long startTime;
        private Long endTime;
        /** 上传+下载合计 */
        private Long flow;
        /** 下载方向 */
        private Long downloadFlow;
        /** 上传方向 */
        private Long uploadFlow;

        public Point() {
        }

        public Point(String label, Long startTime, Long endTime, Long flow, Long downloadFlow, Long uploadFlow) {
            this.label = label;
            this.startTime = startTime;
            this.endTime = endTime;
            this.flow = flow;
            this.downloadFlow = downloadFlow;
            this.uploadFlow = uploadFlow;
        }
    }
}
