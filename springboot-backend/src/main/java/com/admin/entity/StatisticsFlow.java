package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

/**
 * <p>
 *
 * </p>
 *
 * @author QAQ
 * @since 2025-08-14
 */
@Data
public class StatisticsFlow {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 上传+下载的增量总流量。 */
    private Long flow;

    /** 下载方向增量,来自 user.in_flow。 */
    private Long inFlow;

    /** 上传方向增量,来自 user.out_flow。 */
    private Long outFlow;

    /** 上传+下载的累计总流量。 */
    private Long totalFlow;

    /** 下载方向累计流量,用于下一次快照计算增量。 */
    private Long totalInFlow;

    /** 上传方向累计流量,用于下一次快照计算增量。 */
    private Long totalOutFlow;

    private String time;

    private Long createdTime;
}
