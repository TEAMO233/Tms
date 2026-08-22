# 部署与运维工具链

> 覆盖仓库根目录的安装脚本、docker-compose 变体、SQL schema 策略、CI 与发布。改这些文件前必读——这里的历史坑最多。

## 两种机器角色（一切不对称的根源）

| 角色 | 装什么 | 管理入口 |
|---|---|---|
| **面板机**（仅一台） | Docker：mysql:5.7 + springboot-backend + vite-frontend | `tms` 命令 |
| **节点机/转发机**（每台） | gost + sing-box，裸 systemd | 无面板命令，`install.sh` 菜单 |

清理/卸载两边完全独立，脚本里的 purge 都只作用于本侧。

## 安装脚本三件套

### install.sh（节点端，401 行）
- **无 `set -e`**，逐命令自行处理失败；函数式组织；`getopts "a:s:c"`（`-a` 面板地址 `-s` 密钥 `-c` 强制国内镜像）。
- 风格：emoji echo 行，无 ANSI 颜色。检测 CN 出口时下载 URL 前缀 `https://ghfast.top/`。
- 动作：探测架构 → 写 `/etc/gost/config.json`（chmod 600）+ 空 `gost.json` → 写 systemd unit（`Restart=on-failure`）→ 启动。卸载分支会连 sing-box 的服务文件和 `.wants` 软链接一起清。
- 已知怪癖：菜单选项 4 调用了未定义的 `block_protocol`（孤儿选项）——碰到别模仿，也别顺手"修复"扩散行为，先和团队确认。

### panel_install.sh（面板端，~1560 行）
- 开头 `set -e` + `LANG=en_US.UTF-8; LC_ALL=C`。
- compose 和 `gost.sql` 从 **raw main 分支**下载而非 `releases/latest`——因为 `gost-v*` Release 会把同名资产顶掉（文件内有注释解释），别改成 latest。
- 下载后先校验内容（`grep -q "services:"` / `grep -qi "CREATE TABLE"`）再覆盖。
- 生成 `.env`：`DB_NAME/DB_USER/DB_PASSWORD/JWT_SECRET/FRONTEND_PORT/BACKEND_PORT`。
- 装预构建镜像 `ghcr.io/teminuosi/springboot-backend:latest` 等 + `mysql:5.7`（**MySQL 版本是钉死的**，升级要全链路评估）。
- 自带能力：端口占用自动避让（`port_in_use`/`pick_free_port`）、`/usr/local/bin/tms-panel.sh` 自更新（带 `TMS_SELF_UPDATED` 递归守卫）、Caddy 域名 + HTTPS、purge、数据库备份导出、后端健康检查最长等 90s。

### tms-hybrid.sh（源码编译版管理器，165 行）
- 只设 `set -o pipefail`。包装 `docker compose -f docker-compose-hybrid.yml --env-file .env`。
- update = `git fetch --depth 1 origin $TMS_BRANCH && git reset --hard` + `up -d --build`（本地构建，与 panel_install 拉镜像不同）。
- purge **故意跳过**"看起来像面板目录"的安全检查（为了残废安装也能清掉）；按卷名后缀正则 `(mysql_data|...)$` 删卷，因为 compose 会给卷名加项目前缀。

## Compose 三变体

| 文件 | 用途 | 要点 |
|---|---|---|
| `docker-compose-v4.yml` | 生产默认（拉镜像） | mysql 挂载 `./gost.sql:/docker-entrypoint-initdb.d/init.sql:ro`；backend healthcheck `wget --spider http://localhost:6365/flow/test`（start_period 90s）；固定子网 `172.20.0.0/16` |
| `docker-compose-v6.yml` | IPv6 版 | 与 v4 的**全部差异** = `enable_ipv6: true` + 第二个 ipam 子网 `fd00:dead:beef::/48`。改 v4 记得同步 |
| `docker-compose-hybrid.yml` | 源码构建/测试 | `build:` 指 `./springboot-backend`、`./vite-frontend`；**无 backend healthcheck**；gost.sql 挂成 `01-init.sql` |

⚠️ hybrid 变体**绝不能同时挂载 hybrid-schema-\*.sql**——重复 ALTER 会触发 MySQL error 1060 直接中断初始化（compose 文件里有注释警告）。

## SQL Schema 策略（最容易踩坑的地方）

三条路径，各司其职：

1. **全新安装**：`gost.sql`（phpMyAdmin 导出的完整 schema，MySQL 5.7）。所有表 `CREATE TABLE IF NOT EXISTS`。含业务表（forward/node/speed_limit/statistics_flow/tunnel/user/user_tunnel/vite_config）+ 合体新增表（inbound/inbound_user/landing/inbound_line）。
2. **老库增量迁移**：`hybrid-schema-v1/v2/v3.sql`——只加不改的增量脚本，**不幂等**：MySQL 5.7 的 `ADD COLUMN` 没有 `IF NOT EXISTS`，重跑会报 1060，忽略即可（文件头有说明）。仅用于升级旧库。
3. **panel_install.sh 内置迁移**：heredoc 生成 `temp_migration.sql`，用 information_schema 判断列存在性 + `PREPARE/EXECUTE` 执行幂等 ALTER，经 `docker exec -i gost-mysql mysql ...` 应用，用完即删。**这是新迁移的首选模式**（真正幂等）。

**加一个 schema 变更的标准动作**：同时改两处——`gost.sql`（管新装机）+ 一段幂等迁移（管已装机的存量用户，走 panel_install.sh 的 heredoc 或新的 hybrid-schema-vN）。只改一处就会出现新旧面板结构漂移。

## CI 与发布

只有两个 workflow（`.github/workflows/`），**没有任何 lint/test/vet CI**：

- `docker-build.yml`：构建双架构 gost 二进制（UPX 压缩）+ 上传 Release 资产（含三个安装脚本/compose/gost.sql）；按 `VERSION` 标签判断 go-gost 是否需要重建。
- `release-gost.yml`：`gost-v*` tag 触发，`go-version-file: go-gost/go.mod`。

## 提交信息风格

Conventional commit 前缀 + scope + **中文口语化主题，说清楚为什么**：
`fix(hybrid): ...`(11) `feat(hybrid)`(9) `fix(ui)` `fix(node)` `fix(install)` `perf(inbound)` `feat(sub)` `fix(ci)`…
示例：`32e36da feat(install): 端口被占时自动避让,不再让容器静默起不来`

## 移动端壳（android-app / ios-app）

两者都是面板 Web UI 的**薄 WebView 壳**，无任何订阅/VPN 逻辑：

- android-app：Kotlin（`com.flux`，minSdk 24 / target 34），单 `MainActivity.kt` 加载 `file:///android_asset/index.html`，JS 桥对象名 `JsInterface`，面板地址列表存 SharedPreferences(`panel_config`)。
- ios-app：SwiftUI + WKWebView，同样的桥通道经 `WKScriptMessageHandler` 实现，存 UserDefaults(`panel_addresses`)。
- ⚠️ 桥通道名（`getPanelAddresses/savePanelAddress/setCurrentPanelAddress/deletePanelAddress`）必须与 `vite-frontend/src/utils/panel.ts` 保持三方同步——改任何一侧都要检查另外两侧。
- 仓库里提交了预构建产物（`android-app/app/release/flux.apk`、根目录 `flux.ipa`）——这是刻意的分发方式，但 go-gost 的二进制不进 git（见 [go-gost](../go-gost/index.md) 历史教训）。
