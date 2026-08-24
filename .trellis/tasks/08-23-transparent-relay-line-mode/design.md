# 技术设计：透明中转线路机模式

## 1. 边界和命名

新增独立领域对象 `TransparentRelay`，不复用 `Tunnel.type=3`。原因：透明中转走内核 NAT，不是 GOST service/chain；强行塞进现有 tunnel/forward 会让限速、流量、用户权限和 `127.0.0.1` 语义混乱。

用户可见命名：透明中转 / 线路机模式。

后端路径：`/api/v1/transparent-relay/*`。

节点命令：

- `SetTransparentRelays`：全量设置某个节点上的透明中转规则。
- `GetTransparentRelayStatus`：读取节点本机 tms 透明中转 table/counter 摘要。

## 2. 数据模型

新增表 `transparent_relay`：

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | int auto_increment | 主键 |
| `name` | varchar(100) | 规则名 |
| `in_node_id` | int | 入口/线路机节点 ID |
| `entry_port` | int | 客户端连接入口端口 |
| `target_host` | varchar(255) | 目标服务器地址，入口节点必须可访问 |
| `target_port` | int | 目标端口 |
| `protocol` | varchar(16) | `tcp` / `udp` / `tcp_udp` |
| `masquerade` | tinyint(1) | 第一版固定 true |
| `last_error` | varchar(512) null | 最近一次应用失败摘要 |
| `created_time` | bigint | epoch ms |
| `updated_time` | bigint | epoch ms |
| `status` | int | 1 启用，0 暂停，-1 应用失败 |

MyBatis-Plus 默认驼峰映射：`TransparentRelay` -> `transparent_relay`。

## 3. 后端接口

新增 controller/service/mapper/dto：

- `TransparentRelayController`
- `TransparentRelayService`
- `TransparentRelayServiceImpl`
- `TransparentRelayMapper`
- `TransparentRelayDto`
- `TransparentRelayUpdateDto`
- `TransparentRelayStatusDto`
- `TransparentRelayUtil`

接口均 POST：

| 路径 | 权限 | 行为 |
|---|---|---|
| `/list` | 管理员 | 返回所有规则，附入口节点名称/IP |
| `/create` | 管理员 | 校验、保存、下发该节点完整启用规则集 |
| `/update` | 管理员 | 校验、更新、下发旧节点和新节点规则集 |
| `/delete` | 管理员 | 删除记录、下发该节点剩余启用规则集 |
| `/pause` | 管理员 | status=0、下发该节点剩余启用规则集 |
| `/resume` | 管理员 | status=1、下发该节点启用规则集 |
| `/status` | 管理员 | 向节点请求 nft table/counter 摘要 |

服务成功判定沿用 `GostDto.msg == "OK"`。节点不在线、超时或返回错误时，create/update/resume 不应返回成功；记录 `lastError` 并把状态置为 `-1`。

## 4. 后端下发契约

后端对某节点下发完整 payload：

```json
{
  "rules": [
    {
      "id": 1,
      "name": "jp-sg-node-1",
      "entryPort": 1000,
      "targetHost": "140.245.126.119",
      "targetPort": 20000,
      "protocol": "tcp_udp",
      "masquerade": true
    }
  ]
}
```

后端永远只下发 `status=1` 的规则。暂停/删除就是从全量列表里移除后再次下发。

## 5. 节点端实现

新增 `go-gost/x/socket/transparent_relay.go`。

节点处理 `SetTransparentRelays`：

1. JSON 解析为结构化请求。
2. 校验：
   - entry/target port 在 1..65535；
   - protocol 只能是 `tcp`、`udp`、`tcp_udp`；
   - targetHost 不能是空，不能是 `127.0.0.1`、`localhost`、`::1`；
   - 第一版只接受 IPv4 或普通域名/主机名，nft 规则会直接写入目标 host 字符串；生产建议用 IPv4。
3. 生成 `/etc/gost/tms-transparent-relay.nft` 兼容内容（实际 WorkingDirectory 是 `/etc/gost`，相对路径也可落到工作目录）。
4. 执行安全命令序列：
   - `sysctl -w net.ipv4.ip_forward=1`
   - `nft -c -f <file>` 先语法检查
   - `nft -f <file>` 应用专用 `table ip tms_transparent_relay`
5. 不执行 `flush ruleset`，只 `delete table ip tms_transparent_relay` 后重建自己的 table。
6. 返回 OK 或错误摘要。

`GetTransparentRelayStatus` 返回：

```json
{
  "ipForward": true,
  "ruleset": "...redacted nft table output..."
}
```

## 6. nft 规则形状

单表两条 NAT chain：

```nft
flush table ip tms_transparent_relay

table ip tms_transparent_relay {
  chain prerouting {
    type nat hook prerouting priority dstnat; policy accept;
    tcp dport 1000 counter dnat to 140.245.126.119:20000
    udp dport 1000 counter dnat to 140.245.126.119:20000
  }
  chain postrouting {
    type nat hook postrouting priority srcnat; policy accept;
    ip daddr 140.245.126.119 tcp dport 20000 counter masquerade
    ip daddr 140.245.126.119 udp dport 20000 counter masquerade
  }
}
```

为了兼容首装不存在 table 的场景，文件开头先用 `delete table ...` 需要通过命令单独执行，nft 文件本体只负责创建 table。节点代码执行时先 `nft delete table ip tms_transparent_relay`，忽略 not found，再 `nft -f`。

## 7. 前端

新增页面 `vite-frontend/src/pages/transparent-relay.tsx`，注册路由 `/transparent-relay`，侧栏菜单加入“透明中转”。

页面行为：

- 加载节点列表与透明中转列表。
- 表单字段：名称、入口节点、入口端口、目标地址、目标端口、协议。
- 创建/编辑时提示：目标地址不能填目标机 `127.0.0.1`；客户端 SNI/密码/Reality/HY2 参数仍沿用目标节点。
- 列表操作：暂停/恢复、编辑、删除、刷新节点状态。

## 8. 回滚

- 后端回滚：移除新增 controller/service/entity/mapper/dto/util，移除 `SchemaMigration` 新增 table migration，恢复 `gost.sql`。
- 节点回滚：移除新增命令；在节点执行 `nft delete table ip tms_transparent_relay` 可清理透明中转规则。
- 前端回滚：移除页面、路由、菜单、API 函数。

## 9. 验证

- Java 编译：`cd springboot-backend && mvn clean package -DskipTests`
- Go 单元测试：`cd go-gost && go test ./x/socket`
- 前端构建：`cd vite-frontend && npm run build`
- 运行验证：创建测试规则后，在日本节点 `nft list table ip tms_transparent_relay` 能看到规则，客户端连接日本入口访问 `api.ipify.org` 返回目标主服务器 IP。