# 后端目录结构（springboot-backend）

> Java 21 + Spring Boot **2.7.18**（javax.* 时代，不是 jakarta）+ MyBatis-Plus 3.4.1 + HikariCP + Lombok。
> 入口 `com.admin.AdminApplication`（`@EnableAsync @EnableScheduling`），端口 6365。

## 包布局

```
src/main/java/com/admin/
├── AdminApplication.java
├── CodeGenerator.java          # MyBatis-Plus 脚手架生成器（手动跑 main 的开发工具）
├── config/                     # WebMvcConfig、MybatisPlusConfig、WebSocketConfig/Interceptor、
│                               # EncryptionConfig、RestTemplateConfig、CaptchaResourceConfiguration
├── controller/                 # 13 个 Controller（UserController/NodeController/ForwardController/
│                               # TunnelController/FlowController/InboundController/OpenApiController…）
├── service/                    # 接口 extends IService<T>
│   └── impl/                   # extends ServiceImpl<M,T>，@Slf4j @Service
├── mapper/                     # extends BaseMapper<T>，无注解
├── entity/                     # extends BaseEntity，@Data
└── common/
    ├── annotation/RequireRole.java
    ├── aop/                    # LogAnnotation、LogAspect、RoleAspect
    ├── dto/                    # ~30 个请求/视图 DTO（LoginDto、NodeDto、UserPackageDto…）
    ├── exception/              # GlobalExceptionHandler、UnauthorizedException、HttpErrorHandler
    ├── interceptor/JwtInterceptor.java
    ├── lang/R.java             # 统一响应包装
    ├── task/                   # 定时任务：ResetFlowAsync、StatisticsFlowAsync、CheckGostConfigAsync、SchemaMigration
    └── utils/                  # JwtUtil、Md5Util、AESCrypto、GostUtil、SingboxUtil、WebSocketServer、IpUtils…
```

XML mapper 在 `src/main/resources/mapper/**Mapper.xml`（配置项 `mybatis-plus.mapper-locations`）。

## 分层调用规则

```
Controller → Service 接口 → ServiceImpl → MyBatis-Plus IService/BaseMapper（复杂 JOIN 走 mapper XML 返回 DTO）
```

- Service 是 `接口 + impl` 两件套，impl 内部结构：顶部常量块（中文 UI 消息串 `ERROR_*`/`SUCCESS_*`）→ 编号步骤注释 → 小私有助手方法。
- **Service 直接返回 HTTP 包装 `R`**——业务结果用返回值表达，不抛异常。这是全库一致的既有模式，新代码保持一致（利弊见 quality-guidelines）。
- DI 一律字段注入，首选 `@Resource`；循环依赖用 `@Resource @Lazy` 解（UserServiceImpl、ForwardServiceImpl 有先例）。

## 已知分层破例（别扩散）

- `FlowController`（/flow/**，节点上报通道）：直接注入 mapper 且内含配额/停机业务逻辑，返回裸字符串而非 `R` —— 历史特例。新控制器不要学：业务进 Service，返回 `R`。
- `BaseController` 给所有子类预注入 6 个公共 Service（不管用不用）——继承它即可，但别再往里堆。

## 定时与异步

周期性工作放 `common/task/*Async`：每小时流量统计、零点重置、每分钟到期检查，都是 `@Scheduled(cron=...)`。新增定时任务照此归位，不要散落在 Service 里。

## 新增一个业务功能的标准落点

1. entity（继承 BaseEntity）→ 2. mapper（BaseMapper，复杂查询另建 XML）→ 3. service 接口 + impl → 4. dto（JSR-303 中文消息）→ 5. controller 方法（`@PostMapping` + `@Validated` + `@LogAnnotation`，需要管理员再加 `@RequireRole`）→ 6. `CodeGenerator` 只用于起步脚手架，不参与日常流程。
