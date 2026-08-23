# 实施计划：转发订阅链接生成

## 0. 开始前

- [x] 读取并遵守 backend/frontend Trellis spec；确认当前工作区已有改动不被覆盖。
- [x] 保持任务分支基于 `main`；不修改与本功能无关的现有脏文件。
- [x] 检查 Java 源文件中已有的重复/历史代码片段，新增逻辑尽量放在清晰的新助手方法或独立工具中。

## 1. 数据库与实体

- [x] 在 `gost.sql` 的 `forward` 表加入可空 `source_link LONGTEXT`。
- [x] 在 `gost.sql` 的 `user` 表加入可空 `forward_sub_token VARCHAR(64)`。
- [x] 新增 `hybrid-schema-v4.sql`，提供存量库的加法式 SQL。
- [x] 在 `SchemaMigration.java` 加入两个幂等补列。
- [x] 在 `panel_install.sh` 增加同等幂等迁移，保持安装/更新路径一致。
- [x] 更新 `Forward`、`ForwardDto`、`ForwardUpdateDto`、`ForwardWithTunnelDto`、`User` 实体/DTO 映射。
- [x] 更新 `ForwardMapper.xml` 的两条 JOIN 查询返回 `sourceLink`，确认敏感字段只走登录接口。

## 2. 协议链接工具与后端服务

- [x] 新增共享客户端链接工具：
  - [x] 复用 `SingboxUtil` 生成自动入站链接的格式；
  - [x] 为原始 URI 保留认证、查询、fragment 和扩展参数；
  - [x] 单独处理 VMess Base64 JSON 的 `add/port/ps`；
  - [x] 统一 IPv4、域名、IPv6 endpoint 格式和中文错误消息；
  - [x] 校验单条支持的协议链接，不打印完整凭证。
- [x] 让现有 `InboundServiceImpl` 的客户端链接生成复用共享格式，确保旧订阅输出不变。
- [x] 在 `ForwardService` / `ForwardServiceImpl` 增加：
  - [x] 单条转发链接生成：权限、状态、来源解析、入口 endpoint；
  - [x] 当前用户转发订阅 token 生成/复用；
  - [x] 按 token 聚合可用转发并 Base64 编码；
  - [x] 自动协议转发通过 `InboundUser.gostForwardId` 解析，手动转发通过 `sourceLink` 解析；
  - [x] 过滤暂停、错误、到期和无来源转发。
- [x] 在 `ForwardController` 增加类型化 POST 端点和 `@LogAnnotation`，沿用 `R` 错误信封。
- [x] 在 `OpenApiController` 增加免登录转发订阅读取端点，确认不存在 token 时返回空/业务错误而不是泄露数据。
- [x] 保持 `/api/v1/open_api/sub` 和现有协议订阅的行为不变。

## 3. 前端功能

- [x] 在 `src/api/index.ts` 增加单条链接、转发订阅两个接口，并为节点往返接口检查 `SLOW_PATHS`。
- [x] 在 `forward.tsx` 表单加入可选原始协议链接字段，新增/编辑都能保存、替换、清空。
- [x] 在转发卡片加入单条「连接链接」按钮与复制/二维码弹窗。
- [x] 在页头加入「生成转发订阅」按钮与订阅 URL 弹窗，展示可用/跳过数量。
- [x] 订阅按钮明确说明管理员页面只生成当前登录账号名下的转发。
- [x] 无来源转发给出中文提示，不影响普通转发操作。
- [x] 使用 `SubQr`/现有 clipboard 工具，不引入新 UI 依赖。
- [x] 新增字段类型优先收敛到 `src/types/index.ts`，不继续扩大页面内重复 `interface`。

## 4. 验证

- [ ] 后端：`cd springboot-backend && mvn clean package -DskipTests`。
- [ ] 前端：`cd vite-frontend && npm run lint && npm run build`。
- [ ] 工具/接口手工验证：
  - [ ] Hysteria2 原始链接仅替换 host/port；
  - [ ] VMess Base64 可解码且字段完整；
  - [ ] VLESS/Trojan Reality、TUIC、AnyTLS、SS query/凭证保留；
  - [ ] 六个转发的聚合订阅可被 Base64 解码为六行；
  - [ ] 暂停、到期、无来源转发被跳过；
  - [ ] 新增/编辑转发、清空来源链接和重启迁移均可工作；
  - [ ] 普通用户越权访问单条转发和订阅 token 失败。
- [x] 读取构建结果和 git diff，确认没有误改用户已有文件。

### 本轮验证记录

- `vite-frontend/npm run build` 通过；TypeScript 与 Vite 构建均通过。
- 后端所有 Java 源码用当前 JDK 8 的 `javac -source 8 -target 8` 编译通过；项目要求的 `mvn clean package -DskipTests` 已执行，但当前机器没有 JDK 21，Maven 报“无效的目标发行版: 21”。
- `bash -n panel_install.sh`、`git diff --check`、Trellis context 校验通过。
- 只读 ESLint 仍报告仓库既有的无障碍/Hook 规则问题（转发页 3 处，其他页面 17 处）；本次新增代码无语法或类型错误。
- 未连接实际 MySQL/节点环境，因此协议链接与六条订阅的在线接口验收需在部署后的面板上执行。

## 风险回滚点

- 链接改写工具是核心风险点；若某协议 query 解析失败，先让该协议返回“无法生成”，不能返回可能损坏的链接。
- 数据库只做可空列新增；回滚优先停用新端点/UI，再移除迁移列，保留原转发数据。
- 不把原始来源链接写入请求日志、异常消息或诊断报告。
