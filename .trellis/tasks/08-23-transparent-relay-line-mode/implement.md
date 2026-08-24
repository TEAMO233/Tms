# 实施计划：透明中转线路机模式

## 准备

- 使用现有分层：Controller → Service → Impl → Mapper；Service 返回 `R`。
- 所有新增管理员端点加 `@LogAnnotation` 与 `@RequireRole`。
- 节点端新增代码集中在 `go-gost/x/socket/transparent_relay.go`，只在 `websocket_reporter.go` 增加命令分发。

## 任务 1：后端数据模型与迁移

1. 新增实体 `TransparentRelay`。
2. 新增 Mapper `TransparentRelayMapper`。
3. 新增 DTO：create/update/status/list view。
4. 在 `SchemaMigration` 新增 `createTableIfMissing(...)` 并创建 `transparent_relay` 表。
5. 更新 `gost.sql`：增加 `CREATE TABLE transparent_relay`、索引和 auto_increment。
6. 编译后端确认实体映射无错误。

## 任务 2：后端 WebSocket 下发工具

1. 新增 `TransparentRelayUtil`。
2. 实现 `SetTransparentRelays(nodeId, relays)`：构造规则数组并调用 `WebSocketServer.send_msg(..., "SetTransparentRelays")`。
3. 实现 `GetTransparentRelayStatus(nodeId)`。
4. 不打印 target 以外的任何敏感协议信息；该功能本身无协议凭证。

## 任务 3：后端业务服务与接口

1. 新增 `TransparentRelayService` 接口。
2. 新增 `TransparentRelayServiceImpl`。
3. 实现：list/create/update/delete/pause/resume/status。
4. create/update/resume 先校验 node 存在、协议合法、端口合法、targetHost 非 loopback、名称非空。
5. 任何会改变有效规则集的操作都调用 `applyNodeRelays(nodeId)` 全量下发该节点 `status=1` 的规则。
6. update 如果入口节点改变，需要分别下发旧节点和新节点规则集。
7. 下发失败时记录 `lastError`，create 需要回滚新增记录，update/resume 置 `status=-1`。
8. 新增 `TransparentRelayController` 并映射 `/api/v1/transparent-relay`。

## 任务 4：go-gost agent 透明中转命令

1. 新增 `transparent_relay.go`。
2. 写 `buildTransparentRelayNft(rules []transparentRelayRule) (string, error)`，先用单元测试覆盖：
   - TCP+UDP 生成两组 DNAT/SNAT；
   - 单 TCP/UDP 只生成对应协议；
   - 无规则生成空 table；
   - 无效协议/端口/loopback 目标报错。
3. 实现 `handleSetTransparentRelays(data interface{}) error`：解析、生成临时文件、`nft -c -f`、删除旧 table、应用新文件、写持久化文件、开启 ip_forward。
4. 实现 `handleGetTransparentRelayStatus(data interface{}) (map[string]interface{}, error)`：读取 `net.ipv4.ip_forward` 和 `nft list table ip tms_transparent_relay`。
5. 在 `websocket_reporter.go` 增加 case 分发和 response data。
6. 运行 `go test ./x/socket`。

## 任务 5：前端 API、类型、页面、路由

1. 在 `types/index.ts` 增加 `TransparentRelay` 和 `TransparentRelayForm`。
2. 在 `api/index.ts` 增加透明中转 CRUD/status 函数。
3. 在 `api/network.ts` 的 `SLOW_PATHS` 加 `/transparent-relay/create`、`/update`、`/delete`、`/pause`、`/resume`、`/status`。
4. 新增页面 `pages/transparent-relay.tsx`：列表 + 弹窗表单 + 操作按钮。
5. 在 `App.tsx` 注册 `/transparent-relay`。
6. 在 `layouts/admin.tsx` 侧栏加入“透明中转”。
7. 运行 `npm run build`。

## 任务 6：整体验证

1. `cd springboot-backend && mvn clean package -DskipTests`
2. `cd go-gost && go test ./x/socket`
3. `cd vite-frontend && npm run build`
4. 如构建失败，按错误定位并修复，不改变需求边界。
5. 汇总变更、验证结果和部署注意事项。
