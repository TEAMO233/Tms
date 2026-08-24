# Design QA：我的订阅页面

## 结论

final result: passed

本次 QA 覆盖了选定视觉方向 1「订阅指挥台」的桌面首屏和移动端折叠布局。P0/P1/P2 视觉问题已处理；剩余差异属于内容数据或全局品牌范围内的 P3 polish，不阻塞交付。

## 对照证据

- 视觉真值：[/Users/teamo/.codex/generated_images/01a03280-dde0-7401-9fd0-ff402be5bd8f/exec-03862e10-38f9-4b53-ad59-c74db1f540e4.png](/Users/teamo/.codex/generated_images/01a03280-dde0-7401-9fd0-ff402be5bd8f/exec-03862e10-38f9-4b53-ad59-c74db1f540e4.png)
- 桌面实现：[/Users/teamo/Desktop/Tms/design-qa-my-sub-wide-final.png](/Users/teamo/Desktop/Tms/design-qa-my-sub-wide-final.png)，2048×969
- 移动实现：[/Users/teamo/Desktop/Tms/design-qa-my-sub-mobile-final.png](/Users/teamo/Desktop/Tms/design-qa-my-sub-mobile-final.png)，390×844
- 移动完整页面：[/Users/teamo/Desktop/Tms/design-qa-my-sub-mobile-full.png](/Users/teamo/Desktop/Tms/design-qa-my-sub-mobile-full.png)

源视觉与最终实现截图在同一轮 QA 中并排打开检查；重点核对了页面骨架、聚合订阅 hero、筛选条、列表列对齐、线路操作区和底部使用说明。移动端另行检查了卡片堆叠、长 URL 截断、操作按钮可达性与底部导航覆盖关系。

## 状态与交互覆盖

- 已登录管理员 mock 数据，午夜主题，5 条线路，包含直连、中转、运行中、已停用、有配额、不限流量和永久线路。
- 聚合订阅地址、协议总数、复制按钮和二维码入口可见。
- `全部 / 直连 / 中转` 筛选可用，筛选计数与列表结果一致，聚合订阅不随筛选消失。
- 单线路的 `链接` 按需展开可查看真实订阅地址；`复制` 与 `扫码` 操作保留。
- 已验证二维码展开提示和单线路 URL 展开；未改变 API、token 生成规则或路由契约。

## 必查视觉面

### Typography

标题、说明、表头、线路信息和状态文字层级清晰；桌面端标题区与聚合订阅区形成明确的阅读入口，移动端标题与辅助说明自然换行。

### Spacing / layout rhythm

宽屏内容区使用可用横向空间，聚合订阅、筛选、统一线路面板和使用说明形成连续节奏；线路行压缩为表格节奏后，5 条线路与使用说明可在桌面首屏同时出现。小屏切换为纵向信息块，无横向滚动。

### Colors / tokens

保留现有午夜主题的深色 surface、蓝紫 primary、直连蓝色、中转琥珀色、运行中绿色和停用红色。状态色仅用于语义提示，未引入新的全局 token。

### Images / assets

本页没有新增可见图片资产或图标依赖；二维码继续复用现有 `SubQrToggle`，导航、品牌标识和主题背景继续由现有布局提供。

### Copy / content

保留「我的订阅」、聚合订阅说明、线路流量/配额、到期时间、状态和客户端使用说明。mock 截图中的协议数量、日期和订阅域名是测试数据差异，不代表页面语义变化。

## 本轮修复记录

- 将原本纵向堆叠的线路卡片改为统一列表面板，并补齐列标题、状态、进度和行级操作。
- 增加聚合订阅 hero 与 `全部 / 直连 / 中转` 筛选。
- 将每条线路 URL 改为操作列内按需展开，避免每行常驻 URL 输入框把第五条线路和使用说明推到首屏之外。
- 补充宽屏与移动端截图验证，并保留长 URL 截断和小屏 stacked row。

## P3 follow-up polish

- 生成视觉稿使用的是示例品牌名和示例数据；实现按项目既有 TMS 品牌、真实接口数据和现有全局导航呈现。若需要完全复刻生成稿的品牌标识，应另开全局品牌/导航任务。
- 如后续需要更强的表格扫描效率，可在不改变本次结构的前提下继续微调列宽、行高和操作按钮图标化。

