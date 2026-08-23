package com.admin.entity;

import java.io.Serializable;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * <p>
 * 
 * </p>
 *
 * @author QAQ
 * @since 2025-06-03
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class Node extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String name;

    private String secret;

    private String ip;

    private String serverIp;

    /** ISO 3166-1 alpha-2 国家码,由 GeoIP 自动探测也支持管理员手动修正。 */
    @com.baomidou.mybatisplus.annotation.TableField(updateStrategy = com.baomidou.mybatisplus.annotation.FieldStrategy.IGNORED)
    private String country;

    /**
     * 连接域名(可选)。填了就用它替代 server_ip 生成给车友的节点链接,
     * 这样车友在客户端里看到的是域名而不是车主的真实 IP。
     * 留空则沿用 server_ip。注意:域名只是不直接显示 IP,ping 一下还是查得到,
     * 要做到查不到得走 CDN。
     */
    private String domain;

    /**
     * 该节点上 sing-box 是否在运行(不入库,查询时从节点上报的实时状态填入)。
     * gost 和 sing-box 是两个独立服务:sing-box 挂了 gost 照样在线,
     * 面板不单独标出来的话,表现就是「节点显示在线但所有协议都连不上」。
     * null = 节点还没上报过(老版本节点或刚连上)。
     */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Boolean singboxRunning;

    private String version;

    private Integer portSta;

    private Integer portEnd;

    private Integer http;

    private Integer tls;

    private Integer socks;

}
