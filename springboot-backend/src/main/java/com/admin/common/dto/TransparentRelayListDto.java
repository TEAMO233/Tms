package com.admin.common.dto;

import lombok.Data;

@Data
public class TransparentRelayListDto {
    private Long id;
    private String name;
    private Long inNodeId;
    private String inNodeName;
    private String inNodeIp;
    private String inNodeServerIp;
    private Integer entryPort;
    private String targetHost;
    private Integer targetPort;
    private String protocol;
    private Boolean masquerade;
    private String lastError;
    private Long createdTime;
    private Long updatedTime;
    private Integer status;
    /** l4=普通 nftables 透明中转, udp_quic=HY2/TUIC 协议中转 */
    private String relayType;
    private Long inboundId;
    private Long landingId;
    private Long forwardId;
    private String landingName;
    private String targetName;
}
