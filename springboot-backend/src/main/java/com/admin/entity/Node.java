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

    /**
     * 连接域名(可选)。填了就用它替代 server_ip 生成给车友的节点链接,
     * 这样车友在客户端里看到的是域名而不是车主的真实 IP。
     * 留空则沿用 server_ip。注意:域名只是不直接显示 IP,ping 一下还是查得到,
     * 要做到查不到得走 CDN。
     */
    private String domain;

    private String version;

    private Integer portSta;

    private Integer portEnd;

    private Integer http;

    private Integer tls;

    private Integer socks;

}
