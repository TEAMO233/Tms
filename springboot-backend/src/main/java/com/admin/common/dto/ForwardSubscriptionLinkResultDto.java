package com.admin.common.dto;

import lombok.Data;

/** 单条转发协议链接的响应。 */
@Data
public class ForwardSubscriptionLinkResultDto {

    private String link;

    public ForwardSubscriptionLinkResultDto() {
    }

    public ForwardSubscriptionLinkResultDto(String link) {
        this.link = link;
    }
}
