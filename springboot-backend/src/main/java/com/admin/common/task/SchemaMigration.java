package com.admin.common.task;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 启动时的表结构自动迁移。
 *
 * gost.sql 只在【新装】时执行一次,已经装好的面板 tms update 只换镜像、不动表结构。
 * 所以往实体里加字段必须配一次 ALTER,否则老用户一查就 Unknown column,面板直接崩。
 *
 * 这里只做「列不存在就加」这一种最安全的迁移:先查 information_schema 确认列缺失,
 * 再执行 ADD COLUMN。幂等、可重复执行,失败也只记日志不影响启动 ——
 * 迁移挂了顶多是新功能不可用,不能连带把整个面板拖死。
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "schema-migration.enabled", havingValue = "true", matchIfMissing = true)
@Order(1)
public class SchemaMigration implements ApplicationRunner {

    @Resource
    private DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        // 转发机的「连接域名」:填了就用它生成节点链接,车友看到的是域名而不是车主的 IP
        addColumnIfMissing("node", "domain",
                "ALTER TABLE `node` ADD COLUMN `domain` VARCHAR(255) NULL COMMENT '连接域名(可选,留空用 server_ip)'");

        // 节点国家码由 GeoIP 自动探测,允许为空以兼容内网地址和探测失败场景
        addColumnIfMissing("node", "country",
                "ALTER TABLE `node` ADD COLUMN `country` VARCHAR(8) NULL COMMENT 'ISO 3166-1 alpha-2 国家码,GeoIP自动探测'");

        // 「全部线路」聚合订阅 token:一条链接包含该车友所有未停用线路的节点
        addColumnIfMissing("user", "all_sub_token",
                "ALTER TABLE `user` ADD COLUMN `all_sub_token` VARCHAR(64) NULL COMMENT '全部线路聚合订阅token'");

        // 转发订阅与「全部线路」订阅分开,避免裸端口转发混入协议订阅。
        addColumnIfMissing("forward", "source_link",
                "ALTER TABLE `forward` ADD COLUMN `source_link` LONGTEXT NULL COMMENT '原始客户端协议分享链接,仅用于生成转发客户端链接'");
        addColumnIfMissing("user", "forward_sub_token",
                "ALTER TABLE `user` ADD COLUMN `forward_sub_token` VARCHAR(64) NULL COMMENT '转发聚合订阅token'");
        addColumnIfMissing("user", "transparent_relay_sub_token",
                "ALTER TABLE `user` ADD COLUMN `transparent_relay_sub_token` VARCHAR(64) NULL COMMENT '透明中转聚合订阅token'");

        // 仪表板流量趋势拆分:保留每小时上传/下载增量和方向累计值,用于下一次计算增量。
        addColumnIfMissing("statistics_flow", "in_flow",
                "ALTER TABLE `statistics_flow` ADD COLUMN `in_flow` BIGINT(20) NULL COMMENT '下载方向增量' AFTER `flow`");
        addColumnIfMissing("statistics_flow", "out_flow",
                "ALTER TABLE `statistics_flow` ADD COLUMN `out_flow` BIGINT(20) NULL COMMENT '上传方向增量' AFTER `in_flow`");
        addColumnIfMissing("statistics_flow", "total_in_flow",
                "ALTER TABLE `statistics_flow` ADD COLUMN `total_in_flow` BIGINT(20) NULL COMMENT '下载方向累计流量' AFTER `total_flow`");
        addColumnIfMissing("statistics_flow", "total_out_flow",
                "ALTER TABLE `statistics_flow` ADD COLUMN `total_out_flow` BIGINT(20) NULL COMMENT '上传方向累计流量' AFTER `total_in_flow`");

        // 透明中转/线路机模式:入口节点用 nftables DNAT+SNAT 转到目标服务器端口。
        createTableIfMissing("transparent_relay",
                "CREATE TABLE `transparent_relay` ("
                        + "`id` int(10) NOT NULL AUTO_INCREMENT,"
                        + "`name` varchar(100) NOT NULL COMMENT '透明中转规则名',"
                        + "`in_node_id` int(10) NOT NULL COMMENT '入口/线路机节点ID',"
                        + "`entry_port` int(10) NOT NULL COMMENT '客户端连接入口端口',"
                        + "`target_host` varchar(255) NOT NULL COMMENT '入口机可访问的目标地址',"
                        + "`target_port` int(10) NOT NULL COMMENT '目标端口',"
                        + "`protocol` varchar(16) NOT NULL DEFAULT 'tcp_udp' COMMENT 'tcp/udp/tcp_udp',"
                        + "`masquerade` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否SNAT/MASQUERADE',"
                        + "`last_error` varchar(512) DEFAULT NULL COMMENT '最近一次应用失败摘要',"
                        + "`created_time` bigint(20) NOT NULL,"
                        + "`updated_time` bigint(20) DEFAULT NULL,"
                        + "`status` int(10) NOT NULL DEFAULT '1' COMMENT '1=启用 0=暂停 -1=应用失败',"
                        + "PRIMARY KEY (`id`),"
                        + "KEY `idx_tr_node` (`in_node_id`),"
                        + "KEY `idx_tr_node_port` (`in_node_id`,`entry_port`)"
                        + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    /** 列不存在才执行 ddl;任何异常都吞掉(只记日志),不能因为迁移失败导致面板起不来 */
    private void addColumnIfMissing(String table, String column, String ddl) {
        try (Connection conn = dataSource.getConnection()) {
            if (columnExists(conn, table, column)) {
                return;
            }
            try (Statement st = conn.createStatement()) {
                st.executeUpdate(ddl);
                log.info("表结构迁移: {}.{} 已添加", table, column);
            }
        } catch (Exception e) {
            // 并发启动时另一个实例可能刚好加完(1060 Duplicate column),这属于正常情况
            String msg = e.getMessage() == null ? "" : e.getMessage();
            if (msg.contains("Duplicate column") || msg.contains("1060")) {
                log.debug("表结构迁移: {}.{} 已存在,跳过", table, column);
            } else {
                log.warn("表结构迁移失败 {}.{}: {}", table, column, msg);
            }
        }
    }

    /** 表不存在才执行建表;任何异常都吞掉(只记日志),不能因为迁移失败导致面板起不来 */
    private void createTableIfMissing(String table, String ddl) {
        try (Connection conn = dataSource.getConnection()) {
            if (tableExists(conn, table)) {
                return;
            }
            try (Statement st = conn.createStatement()) {
                st.executeUpdate(ddl);
                log.info("表结构迁移: 表 {} 已创建", table);
            }
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            if (msg.contains("already exists") || msg.contains("1050")) {
                log.debug("表结构迁移: 表 {} 已存在,跳过", table);
            } else {
                log.warn("表结构迁移失败 表 {}: {}", table, msg);
            }
        }
    }

    private boolean tableExists(Connection conn, String table) throws Exception {
        DatabaseMetaData meta = conn.getMetaData();
        try (ResultSet rs = meta.getTables(conn.getCatalog(), null, table, new String[]{"TABLE"})) {
            return rs.next();
        }
    }

    private boolean columnExists(Connection conn, String table, String column) throws Exception {
        DatabaseMetaData meta = conn.getMetaData();
        try (ResultSet rs = meta.getColumns(conn.getCatalog(), null, table, column)) {
            return rs.next();
        }
    }
}
