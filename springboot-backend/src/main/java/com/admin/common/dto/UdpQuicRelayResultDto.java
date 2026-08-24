package com.admin.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * HY2/TUIC 协议中转创建结果。link 只返回给 UI,不要写入日志。
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class UdpQuicRelayResultDto {

    private String protocol;
    private Long landingId;
    private Long inboundId;
    private Long forwardId;
    private Integer entryPort;
    private String subToken;
    private String link;
    private Boolean createdLanding;
    private Boolean createdInbound;
    private Boolean assignedUser;
    private String skippedReason;
}
