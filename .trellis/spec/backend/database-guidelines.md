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
