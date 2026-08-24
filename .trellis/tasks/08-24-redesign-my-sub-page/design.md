# 技术设计：我的订阅页面重设计

## 设计边界

本次只改变 `vite-frontend/src/pages/my-sub.tsx` 的页面结构和本地状态呈现，继续挂在现有 `/my-sub` 路由和 `AdminLayout` 下。API、后端 DTO、数据库、订阅 URL 生成规则和移动端路由均不变。

## 数据流与状态

1. 首次加载并行调用现有 `getMyLines()`、`getUserPackageInfo()`。
2. 保留兼容数组及 `{ lines, allSubToken }` 两种后端返回形态，继续将线路放入本地 `lines`，将聚合 token 放入 `allSubToken`。
3. 新增仅用于视图的 `lineFilter` 状态：`all | direct | relay`；不回写服务器、不影响 token。
4. 由 `lines` 派生筛选后的 `visibleLines`、协议总数和筛选计数；由每条线路派生 quota bytes、百分比和展示状态。
5. 复制仍调用 `subUrl(token)` + `copyTextToClipboard` + `react-hot-toast`；二维码仍复用 `SubQrToggle`，避免重复实现二维码焦点和可访问性逻辑。

## 页面结构

- 页面容器：继续受 `AdminLayout` 和主题背景控制，内容最大宽度调整为更适合宽屏的 `max-w-7xl`/全宽布局。
- 标题区：标题、线路数量和独立套餐说明。
- 聚合订阅区：单一高亮 surface，包含推荐 badge、说明、协议总数、地址输入、复制按钮和二维码 toggle。
- 筛选区：三个轻量按钮/分段控件，展示总数和当前选中状态。
- 线路面板：一个统一 surface；桌面使用列标题 + 行，行内按“线路信息 / 协议数量 / 流量使用 / 到期时间 / 状态 / 操作”对齐；小屏改为 stacked row。
- 使用说明：保留现有客户端指引，改为更紧凑的底部说明 surface，不影响主任务。

## 视觉与组件策略

- 延续现有紫色渐变、深色 surface、蓝/紫 primary、直连蓝色和中转琥珀色。
- 继续使用 HeroUI `Card`、`Button`、`Input`、`Chip`，用 Tailwind utility 完成表格行、分隔线、进度条和响应式布局。
- 不增加图标包；新布局使用现有文字按钮与已有页面语言，避免引入新的依赖或手绘图标资产。
- 聚合链接和每行链接都使用 `Input readOnly`，通过 `truncate`/`overflow` 控制长 URL，保留点击选中行为。

## 兼容与回滚

- 只涉及一个前端页面文件，回滚点明确；删除该页面改动即可恢复原 UI。
- 不修改 API 和数据类型，旧后端镜像返回数组或对象的兼容分支继续保留。
- 任何筛选/展示异常都可通过移除 `lineFilter` 派生层回退到全量 `lines` 渲染。

## 风险

- HeroUI `Input` 和 `SubQrToggle` 在列表行内展开二维码时可能增加行高；需要确保展开后不遮挡相邻行，必要时让行内容自然撑开。
- 选定视觉目标是宽屏截图，而现有页面也服务 H5；必须在实现和 QA 中额外检查 768px 以下布局。
