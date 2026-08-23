# 技术设计：手动转发自动匹配协议凭证

## 1. 方案边界

本需求只补充“转发客户端链接/转发订阅”的来源解析，不改 Gost 实际转发配置。现有创建、编辑、诊断、端口分配和协议分配流程继续使用 `Forward.remoteAddr`；新增逻辑只在生成客户端链接时读取它来识别 TMS 已登记的协议。

主要改动边界：

- 后端以 `ForwardServiceImpl.resolveForwardClientLink` 为唯一解析入口，单条链接和聚合订阅自动复用。
- 复用 `ClientLinkUtil.buildInboundLink` 生成协议格式、凭证、TLS/Reality 参数和节点备注，不另写 VLESS/VMess/Trojan/Hysteria2/TUIC/AnyTLS 拼接逻辑。
- 前端不新增接口；只调整“原始协议分享链接”的说明，明确系统协议匹配成功时无需填写。
- 不新增数据库字段，不需要 schema 迁移。

## 2. 链接来源解析顺序

对一条有效转发按以下顺序解析：

1. 校验转发启用状态、到期时间、入口端口，以及隧道存在且启用。
2. 优先查现有 `InboundUser.gostForwardId = forward.id`。这是协议分配流程创建的自动转发，保持现有行为不变。
3. 对没有自动关系的手动转发，尝试按远程地址匹配 TMS 入站：
   - 端口转发（隧道类型 1）：目标节点和客户端入口节点都是 `tunnel.inNodeId`。
   - 隧道转发（隧道类型 2）：目标协议节点是 `tunnel.outNodeId`，客户端入口节点是 `tunnel.inNodeId`。
   - `remoteAddr` 必须只有一个地址，主机必须是 `127.0.0.1`、`localhost` 或 `::1`，端口必须是有效的 1–65535。
   - 在目标节点上按 `listen_port` 精确查询启用的 `Inbound`；结果必须唯一。
   - 再按 `inbound_id + forward.userId` 查询启用的 `InboundUser`；结果必须唯一。这里按转发归属用户查询，不能使用当前管理员 ID，也不能要求 `gostForwardId` 指向当前手动转发。
   - 匹配成功后，用目标 `Inbound` 和用户凭证，配合入口节点 `tunnel.inNodeId`、当前转发入口端口调用 `ClientLinkUtil.buildInboundLink`。
4. 自动匹配没有找到 TMS 协议时，才使用现有 `Forward.sourceLink` 改写入口地址和端口。
5. 自动匹配到协议但凭证缺失/停用时，返回明确的分配提示，不生成无凭证链接；聚合订阅跳过该条，避免把旧或错误来源伪装成当前协议链接。

## 3. 匹配状态和歧义处理

匹配器不返回猜测结果，至少区分以下情况：

- `MATCHED`：唯一入站 + 唯一启用凭证，生成自动协议链接。
- `NO_MATCH`：地址不是单个本机地址、没有对应入站或隧道类型不适用；允许继续走 `sourceLink` 兼容路径。
- `AMBIGUOUS`：同一节点同一端口存在多个启用入站/凭证；不选择任意一条，优先使用显式 `sourceLink`，没有则返回无法唯一匹配的提示。
- `CREDENTIAL_MISSING`：已经唯一匹配到启用入站，但该转发所属用户没有启用凭证；不回退到 `sourceLink`，单条链接提示先分配或启用该协议，聚合订阅跳过。

远程地址包含多个目标时不生成多个协议链接，也不选择第一个地址，因为这会把 Gost 的负载策略误解释成单个协议来源。

## 4. 数据与安全约束

- 使用 MyBatis-Plus `QueryWrapper` 和裸列名查询，沿用项目现有 Mapper/Service 分层。
- 入站和用户凭证均检查 `status`；`null` 按现有代码视为未停用，`0` 视为停用。
- 只记录转发 ID、入站 ID、节点 ID 和失败原因摘要；不记录 UUID、密码、完整协议链接或 `sourceLink`。
- 解析失败仍通过既有 `R.err`/聚合跳过机制返回，不新增异常型业务契约。

## 5. 兼容与回滚

- 老的自动协议转发继续走 `gostForwardId` 分支，已有“我的订阅”不改变。
- 老的手动转发如果已经填写 `sourceLink`，且远程地址不能自动匹配，会继续按原逻辑生成。
- 由于无数据库变更，回滚只需恢复链接解析方法和表单说明；不会留下迁移数据。
