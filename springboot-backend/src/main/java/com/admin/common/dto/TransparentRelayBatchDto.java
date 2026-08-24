package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class TransparentRelayBatchDto {

    @NotNull(message = "入口节点不能为空")
    private Long inNodeId;

    @NotBlank(message = "目标地址不能为空")
    @Size(max = 255, message = "目标地址不能超过255个字符")
    private String targetHost;
}
