# 实现透明中转线路机模式

## Goal

在 TMS 面板中新增“透明中转 / 线路机模式”，让一台入口节点（例如 VMISS 日本）通过内核 L4 DNAT+SNAT/MASQUERADE 将 TCP/UDP 入口端口转发到目标服务器节点端口（例如新加坡主服务器），从而让客户端连接低延迟入口，但真实代理出口仍由目标服务器提供。

## Requirements

- 新增管理员可用的透明中转管理能力，普通用户不应创建/修改/删除透明中转规则。
- 透明中转规则由入口节点的 go-gost agent 通过 WebSocket 接收结构化命令并在本机维护 nftables 规则；不得下发任意 shell 命令。
- 第一版支持 IPv4、单入口端口、TCP/UDP/TCP+UDP 三种协议；默认并强制使用 SNAT/MASQUERADE，确保回程仍经过入口节点。
- 数据持久化到 MySQL，支持创建、列表、更新、删除、暂停、恢复、状态查询。
- 后端必须同步覆盖新装与存量 schema：更新 `gost.sql` 并加入幂等启动迁移。
- 节点端只管理自己的独立 nftables table，不得 flush 全局 ruleset，不得改动 Docker 或系统其它防火墙规则。
- 前端新增独立页面与菜单入口，支持选择入口节点、填写入口端口、目标地址、目标端口、协议与备注说明。
- 前端和后端所有新增业务接口使用 POST，并把会下发节点命令的接口加入前端慢接口超时列表。
- 规则应用失败时，数据库记录不得误标为成功；失败消息应保留中文摘要。
- 删除/暂停/恢复后必须重新向入口节点下发该节点的完整透明中转规则集，避免残留规则。

## Non-Goals

- 第一版不实现每用户限速/计费；nft counter 可以用于状态观察，但不纳入现有 GOST 流量统计。
- 第一版不实现端口范围/端口跳跃 UI；后续可在同一数据模型上扩展 range 字段。
- 第一版不实现 IPv6 或跨地址族 relay。
- 不改变现有 TMS tunnel/forward/GOST 隧道语义，不自动迁移现有 1000–1005 生产转发。

## Acceptance Criteria

- [ ] `transparent_relay` 表在新装 SQL 与存量启动迁移中都存在，重复迁移不报错。
- [ ] 后端新增 `/api/v1/transparent-relay/*` 接口，并对 create/update/delete/pause/resume/status 加管理员权限。
- [ ] 创建一条启用规则时，后端保存记录后向入口节点下发该节点全部启用规则；节点返回 OK 才算创建成功。
- [ ] 更新、暂停、恢复、删除任一规则后，入口节点收到完整规则集并刷新自己的 nftables table。
- [ ] go-gost agent 新增 `SetTransparentRelays` 与 `GetTransparentRelayStatus` 命令，结构化校验 IP/端口/协议，生成专用 nft table 和持久化文件。
- [ ] go-gost 单元测试覆盖 nft 规则生成、输入校验和 TCP+UDP/单协议组合。
- [ ] 前端新增“透明中转”页面与侧栏菜单，列表可展示规则状态并提供创建、编辑、暂停/恢复、删除、刷新状态操作。
- [ ] `mvn test` 或至少 `mvn clean package -DskipTests` 通过。
- [ ] `go test ./x/socket` 或相关 go-gost 测试通过。
- [ ] `npm run build` 通过。

## Notes

- 透明中转目标地址必须是入口节点可访问的真实地址，例如主服务器公网 IP 或 WireGuard 私网 IP，不能填写出口机本地 `127.0.0.1`。
- Loon/客户端连接透明中转时通常只把 server/port 改成入口节点；SNI、Reality、HY2 obfs、UUID/密码仍沿用目标主服务器节点。