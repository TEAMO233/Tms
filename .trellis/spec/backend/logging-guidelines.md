# 日志规范

## 设施

- 门面：SLF4J，一律 Lombok `@Slf4j` 注解拿 logger。
- 配置：`src/main/resources/logback-spring.xml`
  - console：`%d{HH:mm:ss} [%thread] %-5level %logger{36}`
  - 文件：每日滚动 `${LOG_DIR}/yyyy-MM-dd.log`（**行分隔符是 `^`**，不是换行——docker-compose 卷映射到宿主 backend_logs），maxHistory 30 天
  - root 级别 INFO

## 请求日志走 AOP，不走 Filter

几乎每个端点都标了 `@LogAnnotation`，由 `common/aop/LogAspect.java` 输出每请求一行：

```
【请求日志】用户ID:[..], IP地址:[..], 请求方式:[POST], 控制器方法:[..], 请求参数:[JSON], 返回参数:[JSON]
```

异常经 `@AfterThrowing` 输出【异常日志】。**新端点必须带 `@LogAnnotation`**——这是请求审计的唯一来源。

## 新代码的级别纪律

- 真错误用 `log.error`，可疑但能继续的用 `log.warn`，别学存量的"异常也 log.info"。
- 禁止新增 `System.out.println` / `System.err.println` / `e.printStackTrace()`（存量 ~12 处是历史遗留，集中在 IpUtils、UserServiceImpl、WebSocketInterceptor）。
- **绝不打印密钥类信息**：已知反例——`WebSocketInterceptor` 连接时把节点 `secret` 打到了 stdout。节点 secret 等同于该机器的控制凭据，日志里只能出现脱敏形式。

## 注释风格（本项目的 house style）

Java 源码里**没有任何 TODO/FIXME 标记**——知识以长段中文"为什么"注释存在（参考 VersionController 的更新检查逻辑、WebSocketServer.singboxRunning）。写注释时解释动机和坑，不要复述代码在干什么；真有未完成事项就写成中文注释段落说明缘由，而不是丢一个 TODO 词。
