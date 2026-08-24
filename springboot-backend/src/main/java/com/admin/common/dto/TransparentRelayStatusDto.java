package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class TransparentRelayStatusDto {

    @NotNull(message = "节点ID不能为空")
    private Long nodeId;
}
