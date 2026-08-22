# 认证与安全（现状契约，改动需两端/三端同步）

> 没用 Spring Security。JWT 手写、MD5 密码、节点靠 secret——这些是**运行中的既有契约**，本文既讲怎么接，也标出哪些是已知债务。

## 面板用户认证链

```
JwtInterceptor(common/interceptor)  →  挂 /api/**，排除：
    /flow/**、/api/v1/open_api/**、/api/v1/config/get、/api/v1/user/login、/api/v1/captcha/**
    （清单在 config/WebMvcConfig.addInterceptors）
→ 头缺失/无效抛 UnauthorizedException → GlobalExceptionHandler 转 R.err(401, ...)
→ 管理员端点加 @RequireRole 标记注解 → RoleAspect(@Around) 拒绝 role_id != 0（R.err(403)）
```

- JWT 实现在 `common/utils/JwtUtil.java`：手写 HMAC-SHA256 三段式，fastjson2 + URL-safe Base64；claims：`sub`(id)/`iat`/`exp`/`user`/`name`/`role_id`；密钥来自环境变量 `JWT_SECRET`。
- **实际有效期 90 天**（`90L * 24 * 60 * 60 * 1000`），代码注释写的"7天"是过时的——以常量为准。
- 取当前用户**永远不走 Controller 参数**，Service 里静态调用：`JwtUtil.getUserIdFromToken()` / `getRoleIdFromToken()`（内部经 `HttpContextUtils` 从 RequestContextHolder 拿请求头）。
- 前端 token 以裸 `Authorization` header 携带（无 Bearer 前缀）——别"修正"成标准 Bearer，前端没跟着改就全挂。
- 登录可被 tianai-captcha 二次验证门控（开关存 `vite_config` 表）；初始账号 admin_user/admin_user 写死在 UserServiceImpl（`DEFAULT_USERNAME/PASSWORD`），登录响应带 `requirePasswordChange` 标志。

## 节点机（转发机）认证

- 每个 node 行有随机 `secret`，节点凭它自证身份：
  - WebSocket 握手：`config/WebSocketInterceptor.beforeHandshake` 校验 query 参数（`type=1` 是节点，否则按用户 JWT 解）；
  - HTTP 流量上报：`FlowController` 用 `secret` 参数认证（所以 `/flow/**` 在 JWT 白名单里）。
- 面板↔节点载荷可选 **AES-256-GCM** 加密，key = SHA-256(node secret)，`utils/AESCrypto` + `EncryptionConfig` 按 secret 缓存——与 go-gost 端 `x/internal/util/crypto` 对应，改加密必须两侧同步。
- 向节点下发命令走 `GostUtil`/`SingboxUtil` → `WebSocketServer.send_msg(nodeId, data, action)`，每请求挂 `CompletableFuture` 等回包（单次节点往返上限约 10s——前端 SLOW_PATHS 超时设定的根源）。

## 已知安全债务（记录现实；动它们 = 兼容性决策，不是顺手修）

| 项 | 现状 | 为什么不能随手改 |
|---|---|---|
| 密码哈希 | 无盐 MD5 字符串比较（Md5Util.md5；加盐版本存在但没人用） | 存量用户密码全是 MD5 摘要，换算法要迁移方案 |
| 出站 TLS | RestTemplateConfig 关闭了证书校验（trust-all + NoopHostnameVerifier） | 面板要主动连各种自签节点的历史决定 |
| CORS | `*` 配置存在于两处机制 + 控制器 `@CrossOrigin` | 收紧前先盘点 WebView 壳和跨域订阅场景 |
| token | 90 天有效、无吊销机制 | 改短影响所有已发订阅客户端的会话 |

这些点欢迎讨论改进，但任何变更都属于需要团队决策的独立任务，涉及数据迁移或多端同步。

## 新增接口的检查清单

- [ ] 该不该在 JWT 白名单里？不该就让它留在 `/api/**` 保护内
- [ ] 加 `@LogAnnotation`
- [ ] 管理员专属 → `@RequireRole`
- [ ] 入参用带 JSR-303 中文消息的 DTO，不要 `Map<String, Object>`
- [ ] 返回 `R`；401 相关文案不许动（见 error-handling 的前端契约）
