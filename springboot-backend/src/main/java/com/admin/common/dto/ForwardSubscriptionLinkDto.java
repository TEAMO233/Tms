package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/** 生成单条转发协议链接的请求。 */
@Data
public class ForwardSubscriptionLinkDto {

    @NotNull(message = "转发ID不能为空")
    private Long forwardId;
}
