# 后端质量规范

## 构建与验证

```bash
cd springboot-backend
mvn clean package -DskipTests   # CI 的构建方式（.github/workflows/docker-build.yml）
mvn spring-boot:run             # 本地跑需要环境变量：DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/JWT_SECRET/LOG_DIR + JDK 21
```

**测试现状 = 没有**：唯一测试类 `AdminApplicationTests.test()` 是空方法。CI 用 `-DskipTests`。当前验收 = 编译通过 + 启动不报错 + 手动过相关接口（面板页或 curl）。引入测试框架是团队级决策。

配置无 profile，全部环境变量驱动（application.yml）：DB_*、JWT_SECRET、LOG_DIR，端口 6365。Dockerfile 多阶段（temurin 21，JVM `-Xms256m -Xmx512m`），CI 注入 `ARG BUILD_COMMIT/TIME`（env `TMS_BUILD_COMMIT`）供 VersionController 做"有更新"检测（对比 GitHub Actions 最近成功 run 的 head_sha，静态字段缓存 6h）。

## 依赖纪律

| 规则 | 说明 |
|---|---|
| JSON 新代码用 **fastjson2** | fastjson v1(1.2.70) 还在 ~16 个老文件里用，有 CVE 历史；新 import 一律 fastjson2（JwtUtil.java 先例），别再往 v1 上加 |
| 别用死依赖 | `mybatis-plus-join` 声明了但零使用 |
| freemarker/mybatis-plus-generator | 仅 CodeGenerator 脚手架工具用，业务代码别碰 |
| 不引 Spring Security/Shiro | 认证体系是自研轻量方案，见 [auth-and-security](./auth-and-security.md) |

## 代码风格要点

- Lombok 全程：`@Data`/`@Slf4j`/`@SneakyThrows` 都在用。
- Service impl 结构：顶部中文消息常量块 → 编号步骤注释 → 小私有助手方法；跟库内文件长得像比个人偏好重要。
- DTO 校验消息一律中文（直接展示给用户）。
- 新端点入参用类型化 DTO；存量大量 `@RequestBody Map<String, Object> params` + `params.get("id").toString()` 是历史风格，新代码别学（NPE 风险 + 无法校验）。
- 注释：中文、解释为什么；无 TODO/FIXME 文化（见 logging-guidelines）。

## 与其它层的联动点（改后端时自查）

- [ ] 新接口路径若不在 `/api/v1/|/flow/*|/system-info` 前缀下 → 同步改 `vite-frontend/nginx.conf` 反代
- [ ] 动了 401 文案 → 前端 `network.ts isTokenExpired` 要同步（见 [error-handling](./error-handling.md)）
- [ ] 动了 WS 消息结构 → go-gost `x/socket/websocket_reporter.go` 和前端 node.tsx 三端同步
- [ ] schema 变更 → gost.sql + 幂等迁移双写（见 [database-guidelines](./database-guidelines.md)）
- [ ] 节点往返型接口 → 前端 SLOW_PATHS 记得加路径

## 提交信息

Conventional Commits + 中文主题说清楚为什么，scope 用模块名：`fix(hybrid): ...`、`feat(install): 端口被占时自动避让,不再让容器静默起不来`。详见 [deployment/index.md](../deployment/index.md)。
