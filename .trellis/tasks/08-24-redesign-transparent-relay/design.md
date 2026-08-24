# 技术设计：透明中转「运维信号板」

## 1. 视觉目标与范围

本次实现以已选视觉方向 1「运维信号板」为目标：

- 视觉目标：`/Users/teamo/.codex/generated_images/01a03280-dde0-7401-9fd0-ff402be5bd8f/exec-82a486a6-087e-494c-b929-ccacd010afd4.png`。
- 原始参考：`/var/folders/42/qjjlsl6156b_0744mv5sxbcm0000gn/T/codex-clipboard-bdd706ed-2ec9-4b6a-a5d0-1534e01b3c92.png`。
- 只改 `vite-frontend/src/pages/transparent-relay.tsx` 的页面组织与样式；不改后端、API、DTO、路由、AdminLayout、主题和其他页面。
- 所有真实数据仍来自现有 `relays`、`nodes`、`tunnels`、`forwards`、`inbounds`；视觉稿中的节点、端口、数量只作为布局参考，不写死。

选定方向的核心取舍是：用宽屏分组规则表面替代原来的“两列大卡片”，让管理员先看到总量和异常，再按 L4 / HY2-TUIC 进入规则区；操作保持在每条 L4 规则的固定尾部。

## 2. 页面结构

```text
透明中转页面
├─ 页面头部
│  ├─ 标题 + 线路机模式说明
│  └─ 刷新 / 聚合订阅 / 一键添加所有 / 创建 HY2-TUIC / 新增
├─ 说明 Alert
├─ 派生摘要条
│  ├─ 透明中转总数
│  ├─ L4 透明中转数
│  ├─ HY2/TUIC 协议中转数
│  └─ 应用失败数 / 暂停数
├─ L4 透明中转分组
│  └─ 规则行：名称 → 入口 → 目标 → 协议/类型 → 状态 → 操作
├─ HY2/TUIC 协议中转分组
│  └─ 规则行：名称 → 入口 → 落地 → 协议/类型 → 状态 + 当前指引
├─ 空列表状态（仅在没有任何规则时显示）
└─ 现有批量创建 / UDP-QUIC 创建 / L4 编辑 / 节点状态弹窗
```

### 2.1 页面头部和说明

- 延续当前标题、用途说明及 TMS 深色背景。
- 保留五个现有动作及其 loading/点击处理，不新增动作语义。
- 桌面宽屏操作区靠右排列；窄屏自动换行，主操作“新增透明中转”保持可见。
- 警告 Alert 继续使用现有文案，改为紧凑的全宽说明带，避免压过规则摘要。

### 2.2 派生摘要条

摘要只在前端从已加载的 `relays` 派生，不增加接口和新的后端统计口径：

- 总数：`relays.length`。
- L4：`relay.relayType !== "udp_quic"` 的数量。
- HY2/TUIC：`relay.relayType === "udp_quic"` 的数量。
- 异常 / 已暂停：分别统计 `status < 0` 与 `status === 0`，只展示数字，不作为筛选器。

摘要条使用现有 HeroUI 语义色：L4 使用 primary，协议中转使用 warning，失败使用 danger，暂停使用 default；不修改全局主题。

### 2.3 L4 分组规则

L4 规则使用一个分组 surface 和轻量分隔线，不再为每条规则创建一张大卡片。宽屏行按列对齐：

1. 规则名与 `L4 透明中转` 标签；名称通过现有 `relayDisplayName` 计算。
2. 入口节点名称、入口 IP/节点名和 `entryPort`，地址使用等宽字体并允许安全换行。
3. 目标 `targetHost:targetPort`，长地址使用 `min-w-0`、`break-all` 或 `truncate` 配合 `title`。
4. `protocolText(relay.protocol)` 与类型标签。
5. 现有 `statusChip(relay.status)`，失败规则在主信息区直接显示 `lastError`。
6. 固定操作组：编辑、暂停/恢复、节点状态、删除；`statusLoading === relay.inNodeId` 继续驱动节点状态 loading。

窄屏隐藏表头，规则行改为带字段标签的纵向信息块；操作按钮允许换行但不被截断。

### 2.4 HY2/TUIC 分组规则

- 使用 warning 语义区分 `relayType === "udp_quic"`，显示协议、入口以及 `landingName || targetName || "协议落地"`。
- 保留状态展示和当前协议中转指引文案。
- 不渲染 L4 专属编辑、暂停/恢复、节点状态、删除按钮，保持现有业务差异。
- `lastError` 同样在规则主信息区展示，不能只放进状态弹窗。

## 3. 实现边界与复用

- 复用当前页面所有 API 调用、状态变量、校验函数、提交函数、toast、确认删除、加载态和弹窗 JSX；主要替换 `return` 中的页面主体与必要的派生变量。
- 保留 `loadData` 的并行请求顺序及 `getInboundList().catch(...)` 的容错行为。
- 使用已有 HeroUI `Card`、`Button`、`Chip`、`Alert`、`Spinner`、`Modal` 和 Tailwind 工具类；不引入新依赖、不新建全局 CSS。
- 可以在页面文件内新增小型纯展示组件/渲染函数（摘要项、分组行），组件只接收数据和已有回调，不持有新的业务状态。
- 图标若需要，优先复用 `vite-frontend/src/components/icons.tsx` 的现有图标；不手绘新的 SVG，不用 emoji 或 CSS 图形替代图标。
- 不引入搜索、筛选、分页、批量删除、实时监控或新的交互语义；摘要项也不可点击。

## 4. 状态与响应式契约

必须覆盖现有状态：首次加载 Spinner、空列表、批量/协议/L4 提交 loading、聚合订阅 loading、节点状态 loading、API 错误 toast、应用失败和暂停状态、长错误文案、四类弹窗。

响应式策略：

- `xl` 及以上：分组 surface 使用对齐的多列规则行，充分利用主内容宽度。
- `lg` 以下：每条规则转为纵向块，入口/目标不使用固定宽度，操作组自然换行。
- 移动端：页面头部动作换行，规则区不设置固定 `min-width`；Modal body 保持可滚动。

## 5. 风险与回滚

- 风险：搬动列表 JSX 时误删某个现有回调。缓解：事件处理函数保持原样，逐项核对五个顶部动作、L4 四个行操作和四类弹窗。
- 风险：长地址撑破横向布局。缓解：所有地址容器使用 `min-w-0` 与 `break-all`/`truncate`，在移动端使用纵向布局。
- 风险：HY2/TUIC 被错误当成 L4 操作。缓解：统一使用 `relay.relayType === "udp_quic"` 分支，保留原有不显示操作的规则。
- 回滚：只需恢复 `transparent-relay.tsx`；不涉及数据库和后端迁移。

## 6. 设计验收

- 以选定视觉目标的宽屏比例检查：头部动作、说明带、摘要条、L4 分组、HY2/TUIC 分组的层级是否清晰。
- 用至少一条 L4、两类协议中转、暂停和应用失败数据检查状态/错误表达。
- 对照原始截图确认 TMS 侧栏、顶栏、主题和信息语义没有被改写。
- 在桌面、窄桌面和移动视口检查无横向溢出，所有操作和弹窗仍可触达。
