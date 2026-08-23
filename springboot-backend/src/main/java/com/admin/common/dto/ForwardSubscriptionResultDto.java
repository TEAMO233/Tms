package com.admin.common.dto;

import lombok.Data;

/** 当前用户转发订阅的生成结果。 */
@Data
public class ForwardSubscriptionResultDto {

    private String subToken;
    private int availableCount;
    private int skippedCount;

    public ForwardSubscriptionResultDto() {
    }

    public ForwardSubscriptionResultDto(String subToken, int availableCount, int skippedCount) {
        this.subToken = subToken;
        this.availableCount = availableCount;
        this.skippedCount = skippedCount;
    }
}
