package com.admin.common.dto;

import lombok.Data;

/** 当前用户透明中转独立聚合订阅的生成结果。 */
@Data
public class TransparentRelaySubscriptionResultDto {

    private String subToken;
    private int availableCount;
    private int skippedCount;

    public TransparentRelaySubscriptionResultDto() {
    }

    public TransparentRelaySubscriptionResultDto(String subToken, int availableCount, int skippedCount) {
        this.subToken = subToken;
        this.availableCount = availableCount;
        this.skippedCount = skippedCount;
    }
}
