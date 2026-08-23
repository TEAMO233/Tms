# 技术设计:节点订阅显示名加国旗+国家码前缀

## 改动边界

| 层 | 文件 | 改动 |
|---|---|---|
| DB | `gost.sql`、`SchemaMigration.java` | `node` 加 `country VARCHAR(8) NULL`(双写) |
| 实体/DTO | `Node.java`、`NodeUpdateDto.java` | 加 `country` 字段 |
| 工具 | `GeoIpUtil.java`(新建) | IP → ISO alpha-2 国家码 |
| Service | `NodeServiceImpl.java` | 创建/更新节点时挂钩探测落库 |
| 订阅 | `InboundServiceImpl.java` | 命名拼装加旗+国码前缀,含空值回退 |
| 前端 | `vite-frontend/src/pages/node.tsx` | 列表展示旗+国码;编辑表单可手动修正 |

go-gost 节点端、订阅链接协议参数、客户端零改动 —— 只改 remark 展示文本与面板 UI。

## 数据流

```
管理员创建/更新节点(server_ip)
  → NodeServiceImpl 钩子:GeoIpUtil.lookup(ip)(≤3s,失败静默)
  → node.country = "SG" 落库
  → InboundServiceImpl 拼订阅名:flagOf("SG")="🇸🇬" → "🇸🇬 SG VLESS"
```

## 关键设计

### 1. Schema(双写,项目既有约定)

- 存量机:`SchemaMigration.addColumnIfMissing("node", "country", "ALTER TABLE `node` ADD COLUMN `country` VARCHAR(8) NULL COMMENT 'ISO 3166-1 alpha-2 国家码,GeoIP自动探测'")`
- 新装机:`gost.sql` 尾部「加法式迁移」段照抄 `domain` 列先例加 ALTER(该文件整体对新库执行一次)。

### 2. GeoIP 探测(GeoIpUtil)

- 提供方:`http://ip-api.com/json/{ip}?fields=status,countryCode`,免费无 key(45 req/min,仅创建/更新触发,频次无忧)。
- HTTP:Hutool `HttpUtil`(项目已有 hutool-all),连接/读取超时各 3s。
- 结果处理:`status=A8A` 取 `countryCode`;私网/保留段 IP、超时、非 200、解析异常一律返回 `null`,只记 debug 日志。
- URL 常量写死即可;将来要换提供方只动这一个类。

### 3. 探测时机与覆盖规则(NodeServiceImpl)

- `createNode`:入库前若 `serverIp` 非空则同步探测并填充(管理员操作,阻塞 ≤3s 可接受;失败不拦截创建)。
- `updateNode`:当 `serverIp` 与库中不同 **或** 库中 `country` 为空时重探;IP 未变且 country 已有值 **不覆盖**(保护手动修正,R3)。
- 手动修正路径:`country` 入参 `trim().toUpperCase()` + `^[A-Za-z]{2}$` 白名单校验,非法置 null;`buildUpdateNode` 显式加一行拷贝(该方法非 BeanUtils,漏加即静默丢字段——重点自查项)。

### 4. 国旗推导与命名(InboundServiceImpl)

- `flagOf(cc)`:regional indicator 算法 `0x1F1E6 + (c-'A')`,非法入参返回 null。纯函数,不落库。
- `countryPrefix(node)`:`country` 合法 → `"🇸🇬 SG "`(旗+空格+国码+空格);否则 `""`。
- 单线路订阅(`buildClientLink` 的 4 参入口):`namePrefix` 为空时内部取 `countryPrefix`;remark 非空仍优先,套上前缀 → `🇸🇬 SG {备注|协议名}`。
- 聚合订阅(`buildAggregateSubscription`):prefix 由「机器名」改为「`countryPrefix`」,为空回退现状机器名;`→落地名` 段保留在前缀内 → `🇸🇬 SG →落地名 Trojan`。
- 防 double-prefix:聚合路径传非空 prefix 时 `buildClientLink` 不再补 countryPrefix。

## 取舍记录

- **同步探测 vs 异步任务**:选同步短超时。异步要引入线程池/重试状态机,收益仅是省管理员 3 秒,不值得。
- **ip-api.com 免费版走 http**:面板服务端出网调用,无 https 也不泄露敏感数据(只有目标 IP);不可达时功能静默退化为现状,零风险。
- **同国家多机重名**:用户已确认接受(`🇸🇬 SG VLESS` 可能重复),靠备注区分是后续人工动作。

## 兼容性与回滚

- 回归保障:`country` 为空的节点,订阅名与改动前逐字节一致(单线路纯协议名、聚合用机器名)。
- emoji 渲染:V2rayN / sing-box / Streisand 等主流客户端对 remark 内 regional indicator 渲染正常,属文本标准。
- 回滚:git revert 即可。新增列为可空列,残留值无害,无需反向迁移。

## 风险点

1. `buildUpdateNode` 漏拷贝新字段 → 手动修正静默失效(实现时专项核对)。
2. ip-api 在部分网络环境不可达 → 已设计为静默降级,验收时确认日志有 debug 记录而非报错堆栈。
3. 前端 node.tsx 若有节点卡片多处渲染,需找齐展示位(实现时以实际组件结构为准)。
