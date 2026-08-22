# 后端规范（springboot-backend）

> Java 21 + Spring Boot 2.7.18（javax 世代）+ MyBatis-Plus 3.4.1 + MySQL 5.7 + Lombok。
> 面板服务端：用户/节点/转发/隧道/入站管理 + 订阅下发 + 节点 WebSocket 控制 + 流量统计。
> 无 Spring Security（自研 JWT）、无测试、无 @Transactional —— 现状如此，新代码在保持一致的前提下别加重问题。

## 写代码前检查清单

- [ ] 分层：Controller → Service 接口 → Impl → MP wrapper/XML；业务不写进 Controller（FlowController 是历史特例不是榜样）
- [ ] 新端点：`@PostMapping` + `@Validated` + 类型化 DTO（中文校验消息）+ `@LogAnnotation`；管理员端点加 `@RequireRole`
- [ ] 返回 `R`；错误用返回值不用异常；401 文案是前后端契约不许动
- [ ] 查询用 `QueryWrapper` + 裸列名；JOIN 进 XML mapper 映射 DTO
- [ ] schema 变更双写：`gost.sql`（新装机）+ 幂等迁移（存量机）
- [ ] JSON 用 fastjson2；不新增 fastjson v1 import
- [ ] 跨层联动自查（nginx 反代 / WS 三端 / SLOW_PATHS / 401 文案）——见 quality-guidelines 的清单
- [ ] 验证：`mvn clean package -DskipTests` 通过 + 本地起服务手动过接口

## 文档索引

| 文档 | 内容 |
|------|------|
| [directory-structure.md](./directory-structure.md) | 包布局、分层规则、Service 返回 R 的模式、定时任务归位 |
| [database-guidelines.md](./database-guidelines.md) | MP 用法、实体映射、XML mapper、schema 四条迁移路径 |
| [error-handling.md](./error-handling.md) | R 信封错误码、GlobalExceptionHandler、与前端 401 的契约、事务现状 |
| [logging-guidelines.md](./logging-guidelines.md) | @Slf4j + logback、LogAspect 请求日志、级别纪律、注释 house style |
| [auth-and-security.md](./auth-and-security.md) | JWT 链路、@RequireRole、节点 secret 认证、AES-GCM、已知安全债务 |
| [quality-guidelines.md](./quality-guidelines.md) | 构建/环境变量、依赖纪律、代码风格、跨层联动清单 |

## 本层现状速览（2026-08 归纳）

- 一切错误 HTTP 200 + code 入信封；前端只认 `code === 0`。
- Service 直接返回 `R`（业务层与表现层耦合是既有取舍）。
- 零事务注解 + 级联删除无原子性 —— 已知债务，动写操作时心里要有数。
- 密码无盐 MD5、token 90 天、CORS 全开 —— 已记录在 auth-and-security，属团队级决策项。

**Language**: 本目录文档以中文书写，代码标识符保持英文。
