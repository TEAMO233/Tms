# 错误处理

> 核心事实：**所有错误都以 HTTP 200 返回**，错误码装在 `R` 信封里（`common/lang/R.java`）。前端按 `res.code === 0` 判成功。

## R 信封与错误码

```java
// common/lang/R.java
private int code = 0;                    // 0 = 成功
private String msg = "操作成功";
private long ts = System.currentTimeMillis();
private Object data;

R.ok(data)        // 成功
R.err(msg)        // code=-1，通用失败
R.err(code, msg)  // 指定码
```

在用错误码：`0` 成功 · `-1` 通用业务失败 · `401` 未登录/token 失效 · `403` 角色不足（RoleAspect）· `-2` 全局兜底异常 · `500` 参数校验失败。

## 异常体系（刻意地薄）

- 自定义异常只有 `UnauthorizedException extends RuntimeException`，由 `JwtInterceptor` 抛出。
- 统一出口 `common/exception/GlobalExceptionHandler.java`（`@RestControllerAdvice`），三个 handler：
  - `MethodArgumentNotValidException` → `R.err(500, 字段消息)`（DTO 校验消息是中文）
  - `UnauthorizedException` → `R.err(401, msg)`
  - 兜底 `Exception` → `R.err(-2, e.getMessage())`
- **业务错误用返回值不用异常**：`return R.err("xxx不存在")`。Service 层校验结果常以 `R` 哨兵传递，调用方 `result.getCode() != 0` 判断。新代码沿用这个模式——中途改成异常流会让两种风格打架。

## 与前端的隐式契约（改动高危区）

前端 `vite-frontend/src/api/network.ts` 的 `isTokenExpired` 靠 **`code === 401` + 三条精确中文 msg** 识别登录过期并自动登出：

```
未登录或token已过期 / 无效的token或token已过期 / 无法获取用户权限信息
```

改后端这几条文案 = 前端失去自动登出能力。要动必须两端同步（见 [frontend/api-networking.md](../frontend/api-networking.md)）。

## 新代码的错误处理要求

- 给用户的报错消息用**中文**、说人话（会直接 toast 给用户）。
- catch 到异常至少 `log.error("上下文描述", e)` 再转 `R.err`。
- 不要复制的存量坏味道：`catch (Exception e) { e.printStackTrace(); ... }`；`HttpErrorHandler` 把 RestTemplate 的 `hasError()` 恒置 false 吞掉下游 HTTP 错误——排查外部调用问题时记得这里会说谎。

## 已知结构性风险（记录现状，不属"随手修"范围）

全库 **0 个 `@Transactional`**：跨表级联写（如 UserServiceImpl.deleteUser 级联 forward/user_tunnel/inbound_user/inbound_line/user）没有事务保护，存在半完成状态的可能。给新写操作加事务时注意 Spring 代理的坑（自调用不走代理、@Async 方法独立事务）——动老代码前先想清楚，别只加个注解就以为完事了。

## 场景：转发客户端链接的 TMS 协议自动匹配

### 1. Scope / Trigger

- 触发条件：调用单条转发链接接口或转发聚合订阅时，需要把手动转发的 `remote_addr=127.0.0.1:<协议监听端口>` 解析成可用的客户端协议链接。
- 目标：用户不再手填落地协议原始链接；系统按现有入站配置和用户凭证生成链接，同时保持外部协议/历史转发的 `source_link` 兼容。
- 解析入口：`ForwardServiceImpl.resolveForwardClientLink(Forward) -> String`；单条 `POST /api/v1/forward/subscription/link` 和聚合 `POST /api/v1/forward/subscription` 共用该入口。

### 2. Signatures

- 数据读取：`forward.remote_addr`, `forward.user_id`, `forward.in_port`, `forward.tunnel_id`；`tunnel.type`, `tunnel.in_node_id`, `tunnel.out_node_id`；`inbound.node_id`, `inbound.listen_port`, `inbound.status`；`inbound_user.inbound_id`, `inbound_user.user_id`, `inbound_user.status`, `uuid`, `password`。
- 端口转发（`tunnel.type=1`）：协议目标节点=`in_node_id`，客户端入口节点=`in_node_id`。
- 隧道转发（`tunnel.type=2`）：协议目标节点=`out_node_id`，客户端入口节点=`in_node_id`。
- 共享生成器：`ClientLinkUtil.buildInboundLink(Inbound, InboundUser, Node, Forward)`；入口节点只用于链接 endpoint，协议入站只用于协议参数/凭证。

### 3. Contracts

- 链接来源优先级固定为：现有 `InboundUser.gost_forward_id=forward.id` 自动关系 → 单个 loopback 目标端口匹配唯一启用入站和当前 `forward.user_id` 的唯一启用凭证 → 有效 `source_link` 兼容兜底。
- 手动自动匹配只接受一个 `127.0.0.1`、`localhost` 或 `[::1]` 目标；多目标、非 loopback、重复入站或重复凭证不得猜测第一条。
- 匹配成功时不改变 Gost 的 `remote_addr`，客户端链接 endpoint 必须是隧道入口节点的可用地址和当前转发 `in_port`。
- 单条接口以 `R.ok(link)` 返回链接；匹配到协议但没有启用用户凭证时以 `R.err(中文提示)` 返回。聚合订阅遇到无效项只跳过该项，不影响其它链接。
- `source_link` 只在没有可用 TMS 匹配时使用；不记录 UUID、密码、完整协议链接或原始链接。

### 4. Validation & Error Matrix

| 条件 | 处理 | 单条结果 | 聚合结果 |
|---|---|---|---|
| 自动关系有效 | 使用关联入站/凭证 | 生成协议链接 | 加入订阅 |
| 单 loopback + 唯一启用入站 + 当前用户唯一启用凭证 | 自动生成 | `R.ok` | 加入订阅 |
| 非 loopback、无入站或多目标 | 不自动猜测；若有 `source_link` 则改写 | 兼容链接/未配置来源错误 | 跳过 |
| 唯一启用入站但用户无启用凭证 | 不创建凭证、不回退旧凭证 | 提示先分配或启用协议凭证 | 跳过 |
| 入站或凭证停用 | 不参与匹配 | 兼容来源或错误 | 跳过 |
| 入口节点不存在 | 不生成错误 endpoint | `R.err("入口节点不存在")` | 跳过 |

### 5. Good/Base/Bad Cases

- Good：日本入口隧道 `in_node_id=日本`、新加坡落地 `out_node_id=新加坡`，目标为 `127.0.0.1:40003`，唯一匹配新加坡 Hysteria2 和该用户凭证；生成链接地址为日本节点、端口为该转发入口端口。
- Base：旧手动转发目标是公网地址并填有合法 `source_link`；不匹配 TMS 入站，继续只改写入口地址和端口。
- Bad：管理员查看用户转发时用管理员 ID 查询 `InboundUser`、把 `out_node_id` 当客户端入口、或在多个监听端口中取第一条；这些都会串用户或生成不可用链接，必须拒绝。

### 6. Tests Required

- 后端：用 Java 21 执行 `mvn clean package -DskipTests`；没有 Java 21 时至少用当前环境完成源码编译，并明确记录环境阻塞。
- 场景：分别验证端口转发/隧道转发、六个协议端口、不同用户、停用入站/凭证、多目标、重复入站/凭证和 source link 兜底。
- 断言：自动链接的 host 来自入口节点、port 来自 `forward.in_port`、协议和凭证来自目标入站/用户，响应和日志不含秘密。
- 前端：执行 `npm run build`；全量 lint 若受既有错误阻塞，必须确认本次修改没有新增解析或类型错误，且不能使用自动格式化污染无关文件。

### 7. Wrong vs Correct

#### Wrong

```java
// 把目标协议节点当成客户端入口,隧道转发时会让客户端绕过日本入口。
return ClientLinkUtil.buildInboundLink(inbound, inboundUser,
        nodeService.getNodeById(tunnel.getOutNodeId()), forward);
```

#### Correct

```java
// outNode 只负责按监听端口匹配协议;链接 endpoint 始终是 inNode。
Node entryNode = nodeService.getNodeById(tunnel.getInNodeId());
return ClientLinkUtil.buildInboundLink(inbound, inboundUser, entryNode, forward);
```
