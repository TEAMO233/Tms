package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class TransparentRelayUpdateDto {

    @NotNull(message = "规则ID不能为空")
    private Long id;

    @NotBlank(message = "规则名称不能为空")
    @Size(max = 100, message = "规则名称不能超过100个字符")
    private String name;

    @NotNull(message = "入口节点不能为空")
    private Long inNodeId;

    @Min(value = 1, message = "入口端口不能小于1")
    @Max(value = 65535, message = "入口端口不能大于65535")
    private Integer entryPort;

    @NotBlank(message = "目标地址不能为空")
    @Size(max = 255, message = "目标地址不能超过255个字符")
    private String targetHost;

    @NotNull(message = "目标端口不能为空")
    @Min(value = 1, message = "目标端口不能小于1")
    @Max(value = 65535, message = "目标端口不能大于65535")
    private Integer targetPort;

    @NotBlank(message = "协议不能为空")
    private String protocol;
}
