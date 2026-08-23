# 数据库规范（MyBatis-Plus + MySQL 5.7）

> ORM 是 **MyBatis-Plus 3.4.1**；目标库 MySQL **5.7**（compose 钉死 `mysql:5.7` 镜像）。连接池 HikariCP（max-pool-size 20，见 application.yml）。

## 实体约定

- 实体放 `entity/`，`@Data` + 继承 `BaseEntity`（`Long id` `@TableId(IdType.AUTO)`、`createdTime`/`updatedTime` 为**epoch 毫秒 Long**、`status Integer`）。
- **全库不用 `@TableName`**——靠 MyBatis-Plus 驼峰转下划线默认映射（`UserTunnel`→`user_tunnel`、`StatisticsFlow`→`statistics_flow`）。类名起名时就要保证转出来的表名正确。
- 需要"把某列更新为 NULL"时给该字段加 `@TableField(updateStrategy = FieldStrategy.IGNORED)`（库里有先例）。
- 已知瑕疵：`User` 冗余重复声明了 BaseEntity 的四个字段——别模仿，但也别顺手删（有风险无收益）。

## 查询写法（跟库内主流走）

- 条件构造统一用 `QueryWrapper`/`UpdateWrapper` + **裸列名字符串**：
  ```java
  new QueryWrapper<User>().eq("role_id", ADMIN_ROLE_ID)
  ```
  lambda wrapper（`LambdaQueryWrapper`）基本没人用——保持一致，除非团队决策切换。
- 原子计数用 `UpdateWrapper.setSql("in_flow = in_flow + ...")`（`FlowController` 先例）。
- 多表 JOIN 写在 XML mapper 里，结果映射成嵌套 DTO（如 `com.admin.common.dto.UserPackageDto$UserTunnelDetailDto`）。目前只有 `UserMapper.xml`、`ForwardMapper.xml`、`UserTunnelMapper.xml` 有真实 SQL，其余六个是空壳 `<mapper>`——新建实体不必急着造空 XML。

## Schema 变更管理（四条路径并存，改表前必读）

| 路径 | 机制 | 适用 |
|---|---|---|
| `gost.sql`（仓库根） | 全量 dump，挂载为容器 init 脚本 | **全新安装** |
| `hybrid-schema-vN.sql` | 手工增量脚本，**不幂等**（重跑报 1060 忽略即可） | 存量老库手工升级 |
| `common/task/SchemaMigration.java` | `ApplicationRunner` + `@Order(1)`，启动时查 information_schema 后 `addColumnIfMissing(...)`，失败吞掉 | 应用启动自愈 |
| `panel_install.sh` heredoc 迁移 | `SET @sql = IF(EXISTS(information_schema...), 'ALTER...', ...)` + PREPARE/EXECUTE，幂等 | `tms update` 时执行 |

**规则：任何 schema 变更必须同时覆盖"新装"和"存量"两条线**（gost.sql + 幂等迁移），详见 [deployment/index.md](../deployment/index.md)。只改一处 = 新旧面板结构漂移。MySQL 5.7 的 `ADD COLUMN` 无 `IF NOT EXISTS`，所以幂等判断都要靠 information_schema。

## 反模式

- 不要在代码里拼 SQL 字符串执行（除 setSql 的原子自增这种既有用法）。
- 不要引入 JPA/JOOQ 等第二套 ORM。
- 不要假设 MySQL 8 特性可用（窗口函数部分有、但 `ADD COLUMN IF NOT EXISTS` 这类就是没有）。

## 场景：节点国家码 GeoIP 与订阅展示

### 1. Scope / Trigger

- 触发条件：节点实体新增 `country` 列，并由节点管理接口、GeoIP 服务、订阅生成和节点页面共同消费。
- 目标：保存可空的 ISO 3166-1 alpha-2 国家码；国家码存在时只改变订阅 `remark` 和面板展示，不改变协议参数。

### 2. Signatures

- DB：`node.country VARCHAR(8) NULL`；新装写入 `gost.sql`，存量库通过 `SchemaMigration.addColumnIfMissing(...)` 幂等添加。
- GeoIP：`GeoIpUtil.lookup(String ip) -> String|null`，返回大写两位国家码或 `null`。
- 节点接口：`createNode` 使用 `serverIp`，为空时回退 `ip`；`updateNode` 接收可选 `country` 字段。
- 订阅：`country=SG` 时节点 `remark` 前缀为 `🇸🇬 SG `；非法或空值不产生前缀。

### 3. Contracts

- 创建节点始终对有效的实际 GeoIP 地址做一次短时探测；更新节点仅在实际探测地址变化或库中 `country` 为空时探测。
- 更新请求中的合法两位字母国家码先规范化为大写并优先保存，用于覆盖 CDN/中转出口的自动判断；IP 未变且已有国家码时，空输入不得抹掉人工修正。
- GeoIP 超时、非 200、服务返回失败、解析异常、私网/保留地址均返回 `null`，只写 debug 日志，不得改变节点创建/更新接口的成功路径。
- 单线路订阅格式为 `旗帜 国家码 协议名/备注`；聚合订阅用同样的国家前缀替代机器名，中转继续追加 `→落地名`。国家码为空时必须逐字节回退到原有命名。

### 4. Validation & Error Matrix

| 输入/状态 | 处理 | 对外结果 |
|---|---|---|
| 合法公网 IP，返回 `success + countryCode=SG` | 保存 `SG` | 节点接口正常；订阅显示 `🇸🇬 SG ...` |
| 空值、私网、回环、链路本地、CGNAT、文档/保留地址 | 跳过查询 | 保存空国家码；节点接口正常 |
| 超时、连接异常、非 200、`status != success`、非法 countryCode | debug 降级 | 保存空国家码或保留既有人工值；节点接口正常 |
| 更新传入 `sg` / `SG` | trim 后转大写并校验两位字母 | 保存 `SG`，不被自动探测覆盖 |
| 更新传入空值且 IP 未变、库中已有国家码 | 不探测并保留旧值 | 人工修正不丢失 |
| country 不是两位字母 | 视为未提供；IP 变化/旧值为空时允许自动探测 | 不保存非法国家码 |

### 5. Good/Base/Bad Cases

- Good：`serverIp=<新加坡公网 IP>` 探测到 `SG`，单线路输出 `🇸🇬 SG VLESS`，中转输出 `🇸🇬 SG →落地名 Trojan`。
- Base：旧节点 `country=NULL` 或探测失败，单线路仍只显示原备注/协议名，聚合仍显示机器名。
- Bad：把 `country` 当成必填字段、因 GeoIP 服务不可达返回 5xx、把机器名和国家前缀同时拼入聚合名称，或直接把 emoji 写进数据库。

### 6. Tests Required

- Schema：新装 SQL 与 `SchemaMigration` 都能产生可空 `node.country`，重复启动不报错。
- 后端编译：使用项目要求的 Java 21 执行 `mvn clean package -DskipTests`；断言 `GeoIpUtil`、实体映射和订阅拼装均可编译。
- GeoIP/接口：覆盖公网成功、私网跳过、超时/非 200/非法响应静默降级，以及更新时 IP 变更和人工覆盖分支。
- 订阅：构造 `country=SG`、`country=NULL`、直连和中转节点，Base64 解码后分别断言新格式和旧格式兼容性。
- 前端：执行 `npm run lint && npm run build`，断言节点列表显示旗帜/国家码，编辑表单能提交两位国家码且拦截非法输入。

### 7. Wrong vs Correct

#### Wrong

```java
node.setCountry(GeoIpUtil.lookup(node.getServerIp()));
// GeoIP 失败时覆盖掉管理员已经手动修正的国家码
```

#### Correct

```java
if (manualCountryIsValid) {
    updateNode.setCountry(normalizedManualCountry);
} else if (geoIpAddressChanged || storedCountryIsBlank) {
    updateNode.setCountry(GeoIpUtil.lookup(effectiveGeoIpAddress));
} else {
    updateNode.setCountry(storedCountry);
}
```
