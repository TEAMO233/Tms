# 执行计划:节点订阅显示名加国旗+国家码前缀

> 按序执行;每步末尾的验证命令通过才进下一步。任何一步失败即停,修复或回滚(git checkout 该步改动)后再继续。

## Step 1 — Schema 双写

- [x] `SchemaMigration.java` 追加:`node.country` 的 `addColumnIfMissing`(照 `all_sub_token` 条目格式)
- [x] `gost.sql` 尾部迁移段追加 `ALTER TABLE node ADD COLUMN country ...`(照 `domain` 先例,含中文注释)

验证:`cd springboot-backend && mvn -q compile`（代码已完成；当前环境仅有 JDK 8，项目要求 JDK 21，待具备 Java 21 的环境补跑）
回滚点:两处均为纯新增行,git diff 可直接 revert。

## Step 2 — 实体与 DTO

- [x] `Node.java` 加 `private String country;`(带注释:ISO 3166-1 alpha-2)
- [x] `NodeUpdateDto.java` 加 `country`(可选字段,不加 @NotBlank)
- [x] `NodeServiceImpl.buildUpdateNode` 显式加拷贝行 + 规范化(trim/大写/`^[A-Za-z]{2}$` 白名单,非法置 null)—— **专项核对,漏加即静默丢字段**

验证:`mvn -q compile`（同上，受 JDK 8 / target 21 阻塞）

## Step 3 — GeoIpUtil(新建)

- [x] `common/utils/GeoIpUtil.java`:静态 `lookup(String ip)` → String(alpha-2 或 null)
  - 私网/空 IP 直接返回 null(覆盖 IPv4/IPv6 私网、保留和特殊网段)
  - Hutool `HttpUtil.createGet`,超时 connect/read 各 3000ms
  - fastjson2 解析 `status=="success"` 取 `countryCode`;一切异常 catch 后 debug 日志返回 null

验证:`mvn -q compile` + 临时 main 方法或日志实测一次公网 IP 查询（编译和外部接口实测待具备 Java 21/可联网运行环境补跑；旗帜算法静态核对已完成）

## Step 4 — NodeServiceImpl 探测挂钩

- [x] `createNode`:`serverIp` 非空 → 探测并填入新节点再入库
- [x] `updateNode`:(实际 GeoIP 地址变化 || 库中 country 为空)且未手动传合法 country → 重探落库
- [x] 失败路径:仅 log.debug,不改变接口返回值

验证:`mvn -q compile`;起服务后创建测试节点看 `country` 落库、断网/假 IP 看降级（待 Java 21 和数据库环境）

## Step 5 — InboundServiceImpl 命名改造

- [x] 加 `flagOf(String)` 与 `countryPrefix(Node)` 私有静态方法
- [x] 单线路:`buildClientLink` 在 namePrefix 为空时补 countryPrefix(remark 优先规则不变)
- [x] 聚合:`buildAggregateSubscription` prefix 改为 countryPrefix,空回退机器名,`→落地名` 段保留
- [x] 核对不产生 double-prefix;country 为空路径输出与改动前逐字节一致

验证:`mvn -q compile`;手工构造 country=SG / null 两台节点的订阅 base64 解码比对（代码路径已核对；运行实测待 Java 21/服务环境）

## Step 6 — 前端 node.tsx

- [x] 节点列表/卡片展示「旗+国码」(本地 flagOf 同算法 TS 版,country 为空不显示)
- [x] 编辑弹窗加可选「国家码」输入(2 字母校验,placeholder 提示留空自动探测)

验证:`cd vite-frontend && npm run build`(含 tsc)（当前缺少 `node_modules`，npm 依赖安装未完成）

## Step 7 — 全量质量检查(最后一轮跑全范围)

- [ ] `cd springboot-backend && mvn clean package -DskipTests`（阻塞：JDK 8 无法编译 target 21）
- [x] 对照 `.trellis/spec/backend/index.md` 写代码前检查清单逐项过
- [x] 跨层联动自查:无 nginx/WS/401 契约触碰;fastjson2 only
- [x] 派发 trellis-check 做规范符合性复查

## 验收对照(prd.md Acceptance Criteria 全勾后才进 Phase 3)

## 回滚总策略

单分支顺序提交,任一步出问题 `git checkout -- <files>` 丢弃该步;整体废弃 revert 整个 commit。列迁移可逆性无需考虑(可空新增)。
