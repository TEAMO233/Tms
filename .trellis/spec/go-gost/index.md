# go-gost：节点端代理（gost fork）

> 本目录是 [go-gost/gost](https://github.com/go-gost/gost) 的 fork，**module 名保持上游原名未改**（`github.com/go-gost/gost`），并用 `replace github.com/go-gost/x => ./x` 把 x 库钉在本地 vendored 树上（`go-gost/go.mod` 末行）。Go 1.23。
>
> 它编译出的二进制就是部署在每台**转发机**上的节点端程序（裸 systemd，非 Docker）。

## 改代码的第一原则

上游代码占绝大多数。**不要重构/美化上游文件**——保持与上游可 diff，团队自己的逻辑集中在下面这些自建位置。新功能优先加在新包里，而不是散进上游文件。

## 团队自有代码地图（改哪查哪）

| 位置 | 职责 |
|---|---|
| `x/socket/websocket_reporter.go` | **面板 agent 核心**（~1300 行）：主动外连面板 `ws://面板/system-info?type=1&secret=...&version=...`，上报 gopsutil 系统指标 + `singbox_running`；接收命令：service/chain/limiter 增删改、协议封禁(`handleSetProtocol`)、TCP ping、sing-box 配置与 Reality 密钥 |
| `x/socket/singbox.go` | 本机 sing-box 二进制的下载安装（含国内镜像回退）与 systemd 管理、Reality 密钥对、自签证书 |
| `x/socket/service.go` / `chain.go` / `limiter.go` / `config.go` | 对 gost 自身 registry/config 的 CRUD，快照落盘 `gost.json`；service 创建走"两阶段创建 + 失败回滚已注册项"模式 |
| `x/socket/testoutbound.go` | 经前置机 socks 链测落地出口 IP |
| `config.go` + `main.go` | 重写过的入口：读工作目录下纯 JSON `config.json`（`{addr, secret, http, tls, socks}`），起 reporter 后以 go-svc 托管 gost |
| `x/service/traffic_reporter.go` | 流量上报：周期 POST `http://面板/flow/upload?secret=...`（AES 加密，`x/internal/util/crypto`）+ 每 10 分钟配置快照到 `/flow/config` |
| `x/service/service.go`（改动点） | 服务统计 ticker 内调用 `sendTrafficReport(...)`，成功后清零计数 |
| `x/limiter/traffic/limiter.go`（改动点） | 限速重调：速率按 MB/s 整数语义解释，burst 钳制 `[64KB, 256KB]`（`burstDivisor=8`）——保证短时测速也贴限速值，注释里有完整缘由 |
| `x/internal/util/tls/tls.go`、`x/config/parsing/tls.go`（改动点） | 持久化 `device.id` 文件 + 确定性"伪装"随机 CN/SAN 域名自签证书（协议封禁/UDP 修复） |

## 本模块代码风格（与后端不同，别混）

- 错误：`fmt.Errorf("中文描述: %v", err)` —— 中文消息、只用 `%v` 包裹，本模块没有 `%w`/`errors.Is` 链。
- 日志：新代码一律裸 `fmt.Printf` + emoji 前缀（✅ ❌ ⚠️ 🔐）。**不用** gost 自己的 xlogger（那是上游内部用法）。仅 websocket_reporter.go 里就有 39 处 Printf。
- 配置解析用 **JSON 不是 YAML**（agent 层）：手写 `json.Unmarshal` 进扁平 struct + json tag；`gost.json` 快照走 gost 自己的 `config.Global().Write(f, "json")`。
- 注释：口语化中文，解释为什么（参考 limiter.go 的 burst 钳制注释块）。

## 历史教训

- 曾加过整个 `gfw/` 子模块（~8100 行）后整体删除（commit `2f4f1c9`），替代实现收进 `handleSetProtocol`；`x/traffic/` 包同样加了又删，继任者是 `traffic_reporter.go`。大功能先想清楚要不要独立子模块。
- **绝不提交编译产物**：曾有 43MB 的 gost 二进制被提交后又删除。

## 构建与发布链路

- CI `.github/workflows/docker-build.yml`：`CGO_ENABLED=0 GOOS=linux GOARCH={amd64,arm64} go build -ldflags="-s -w"` + UPX `--best --lzma`；按 `VERSION` 环境变量（当前 `1.0.1`）判断 go-gost/ 内容是否有变化决定要不要重建；产物连同 install.sh/panel_install.sh/compose/gost.sql 一起传 GitHub Release。注意它 pin 了 `go-version: '1.21'` 而 go.mod 是 1.23——靠 setup-go 的 toolchain 自动切换兜底，升 Go 版本时要检查这个 workflow。
- `.github/workflows/release-gost.yml`：`gost-v*` tag 触发，`go-version-file: go-gost/go.mod` 构建 hybrid gost。
- 节点机上由 `install.sh` 从 Release 下载预编译二进制装到 `/etc/gost/gost`，systemd unit 设 `WorkingDirectory=/etc/gost`——所以运行时的 `config.json`、`gost.json`、`device.id` 都在那个目录。

## 与面板的契约（跨层，改动需两端同步）

WS 协议：前端监控页连 `/system-info?type=0`，节点 agent 以 `type=1` 上报/接收命令（见 `x/socket/websocket_reporter.go`）。改消息结构 = 同时改 go-gost、springboot-backend 的 WebSocketServer、vite-frontend 的 node.tsx，且 nginx 的 `/system-info` WS 升级配置必须继续覆盖。
