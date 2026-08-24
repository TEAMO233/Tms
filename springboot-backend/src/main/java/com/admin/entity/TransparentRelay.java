package com.admin.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 透明中转 / 线路机模式规则。
 *
 * 这类规则不走 Gost service,而是由节点 agent 在入口机维护 nftables DNAT+SNAT。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class TransparentRelay extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String name;

    /** 入口/线路机节点 ID */
    private Long inNodeId;

    /** 客户端连接入口端口 */
    private Integer entryPort;

    /** 入口节点可访问的目标地址,通常是主服务器公网 IP 或 WireGuard IP */
    private String targetHost;

    /** 目标节点端口 */
    private Integer targetPort;

    /** tcp / udp / tcp_udp */
    private String protocol;

    /** 第一版固定开启 SNAT/MASQUERADE,确保回程仍经过入口机 */
    private Boolean masquerade;

    /** 最近一次节点应用失败摘要 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String lastError;
}
