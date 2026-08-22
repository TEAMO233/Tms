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
