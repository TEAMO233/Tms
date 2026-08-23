# 技术设计：转发订阅链接生成

## 1. 设计目标与边界

本功能增加一条与现有协议订阅并行的「转发订阅」链路：

- 转发入口仍由 Gost 按现有逻辑监听，功能不改变数据面；
- 协议链接只改变客户端连接的入口 host/port，不改变原始协议凭证和参数；
- 自动协议转发复用已有 `InboundUser -> Forward` 关系；
- 手动转发通过可选的 `source_link` 保存原始客户端分享链接；
- 一个用户对应一个稳定的转发订阅 token，订阅内容动态读取该用户当前可用的转发。

不把普通转发的 `remote_addr` 当成协议来源：`127.0.0.1:40000` 只有网络目标语义，没有协议、凭证或 TLS 参数。

## 2. 数据模型与迁移

### 2.1 `forward.source_link`

新增可空 `LONGTEXT source_link`：

- 手动转发可填写一条完整客户端分享链接；
- 空值表示该转发仍是裸端口转发，不可生成协议链接；
- 创建/编辑时后端校验为单条支持的协议链接，保存原始字符串以最大限度保留 query、fragment 和协议扩展参数；
- 该字段只通过登录后的转发接口返回，公开订阅接口只返回改写后的客户端链接。

### 2.2 `user.forward_sub_token`

新增可空 `VARCHAR(64)`：

- 第一次在转发管理点击生成订阅时创建随机 token；
- token 绑定当前用户，不能通过请求参数指定其他用户；
- 删除/新增转发不改变 token，客户端更新订阅即可看到最新可用内容；
- 与现有 `all_sub_token` 分开，避免把普通裸转发意外混入已有「全部线路」订阅。

### 2.3 迁移覆盖

同时更新：

- 根目录 `gost.sql`（新装库）；
- 新增 `hybrid-schema-v4.sql`（存量手工升级）；
- `springboot-backend/.../SchemaMigration.java`（应用启动幂等补列）；
- `panel_install.sh`（更新脚本的幂等迁移）。

## 3. 链接解析与改写

新增一个共享的客户端链接工具，避免协议管理和转发订阅各自维护一套格式：

### 3.1 TMS 自动协议转发

按 `InboundUser.gostForwardId = Forward.id` 查找来源：

1. 读取 `Inbound.protocol`、`Inbound` 的 Reality/TLS/SNI 参数；
2. 读取该用户的 `InboundUser.uuid/password`；
3. 使用转发隧道入口节点的地址和 `Forward.inPort` 作为客户端 endpoint；
4. 使用现有 `SingboxUtil` 的协议链接格式生成链接。

自动关联优先级高于手动 `source_link`，不根据转发名称、目标端口或 `127.0.0.1` 猜测协议。

### 3.2 手动原始分享链接

对 `source_link` 做最小改写：

- `vless://`、`trojan://`、`hysteria2://`/`hy2://`、`tuic://`、`anytls://`、`ss://` 等 URI：只替换 authority 中的 host/port，保留 userinfo、query 和 fragment；
- `vmess://`：Base64 解码 JSON，仅替换 `add`、`port`，同时将节点名写入 `ps`；
- 原链接的 scheme、认证信息、SNI、Reality 公钥、短 ID、WebSocket/gRPC 路径、混淆参数等不丢失；
- IPv6 入口统一输出 `[addr]:port`；
- 单条来源链接不支持换行或订阅 URL，无法识别的 scheme 在保存/生成时返回中文错误。

节点 endpoint 取入口隧道对应节点的 `domain`，为空时取 `serverIp`；若地址字段含多个候选，仅取第一个可展示地址，后端转发的多目标选择仍由 Gost `strategy` 负责。

## 4. 后端 API 与服务边界

### 4.1 转发 CRUD 扩展

`Forward`、`ForwardDto`、`ForwardUpdateDto`、`ForwardWithTunnelDto` 增加 `sourceLink`。现有创建/编辑接口保存该字段；远程目标和 Gost 服务下发逻辑不改变。

### 4.2 单条客户端链接

新增登录接口：

```text
POST /api/v1/forward/subscription/link
body: { "forwardId": 123 }
return: { "link": "hysteria2://..." }
```

Service 先按现有 `validateForwardExists` 做权限校验，再要求转发处于可生成状态，最后按 3.1/3.2 解析。无来源时返回“该转发未配置协议来源”。

### 4.3 当前用户转发订阅

新增登录接口：

```text
POST /api/v1/forward/subscription
return: {
  "subToken": "...",
  "availableCount": 6,
  "skippedCount": 0
}
```

前端用当前 origin 组成：

```text
/api/v1/open_api/forward_sub?token=<subToken>
```

新增免登录读取接口：

```text
GET /api/v1/open_api/forward_sub?token=<subToken>
```

返回 Base64 编码的逐行客户端链接。生成时只读取 token 对应用户的 `forward`，筛选状态正常且未过期、并能解析出协议来源的转发；没有来源的转发跳过，不生成伪造节点。空结果返回空 Base64 内容并保留稳定 token。

不在本 MVP 为转发订阅伪造 `subscription-userinfo`，避免把多个转发/隧道配额错误合并；现有协议订阅接口保持原样。

## 5. 前端交互

### 5.1 转发编辑表单

新增可选「原始协议分享链接」文本域：

- 示例 `hysteria2://...@56.78.34.123:4001`；
- 说明“只用于生成客户端链接，不改变 Gost 的目标地址”；
- 空值允许保存；
- 后端解析失败时 toast 显示具体错误。

### 5.2 转发管理页

- 页头增加「生成转发订阅」按钮，弹窗显示订阅 URL、可用数量、跳过数量、复制和二维码；
- 每张转发卡增加「连接链接」按钮，弹窗显示单条链接、复制和二维码；
- 无来源的转发仍显示正常的入口/目标/诊断/删除等功能，但链接按钮提示未配置来源；
- 管理员列表可见全部转发，但页头订阅只针对当前登录账号，界面明确显示范围，避免不同用户凭证混合；
- 不在卡片直接展示 `source_link`，避免把原始密码长期暴露在列表上。

## 6. 兼容、风险与回滚

- 现有 `InboundServiceImpl.buildSubscription` 和 `/open_api/sub` 不修改语义；已有协议/中转订阅继续按原路径工作。
- 老转发的 `source_link` 为空，服务行为不变；用户编辑转发补充来源后即可使用新功能。
- 原始分享链接含密码，数据库字段按现有 `landing.link` 的明文存储模式处理；日志禁止打印完整来源链接和生成的完整客户端链接。
- 迁移只加可空列，回滚时删除新增列即可；删除列前应先停止使用新接口。
- 新链接只改变入口 endpoint，若转发实际协议类型与来源链接不匹配，网络层可能仍能建立但协议握手会失败；保存时只能校验格式，不能保证远端协议语义正确，因此页面应保留诊断入口。

## 7. 重点验证场景

1. 原始 Hysteria2 链接 `56.78.34.123:4001` + 日本入口 `入口IP:1000`，输出只替换为日本 endpoint。
2. VMess Base64 链接改写后仍能解码，`add/port` 正确，其他字段不丢。
3. VLESS Reality、Trojan Reality、TUIC、AnyTLS 的 query 参数完整保留。
4. 六条可用转发生成一条 Base64 订阅，暂停其中一条后刷新订阅不再包含该条。
5. 无 `source_link` 的普通裸转发不出现在协议订阅里，但仍能复制普通入口地址。
6. 普通用户不能通过 `forwardId` 或订阅 token读取其他用户的转发；管理员全局列表不改变权限边界。
