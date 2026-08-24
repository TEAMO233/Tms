package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 创建 HY2/TUIC 协议中转:入口节点新建协议入站,出站指向目标节点对应协议。
 */
@Data
public class UdpQuicRelayCreateDto {

    @NotNull(message = "入口节点不能为空")
    private Long ingressNodeId;

    @NotNull(message = "目标节点不能为空")
    private Long targetNodeId;

    @NotEmpty(message = "请选择协议")
    private List<String> protocols;

    /** 可空:默认当前登录用户。 */
    private Long userId;

    /** 预留:第一版不自动暂停旧 L4 HY2/TUIC。 */
    private Boolean pauseOldL4;
}
