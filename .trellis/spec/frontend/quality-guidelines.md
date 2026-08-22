# 前端质量规范

## 验证命令

```bash
cd vite-frontend
npm run dev      # 开发服务器，端口 3000，host 0.0.0.0；无 dev proxy，直连 VITE_API_BASE(.env.development → http://127.0.0.1:6365)
npm run lint     # eslint --fix
npm run build    # tsc && vite build —— 类型错误在这里暴露，提交前必跑
```

没有测试框架、没有前端 CI —— `lint` + `build` 通过 + 手动过一遍相关页面就是当前的验收标准。

## ESLint 约定（eslint.config.mjs，flat config）

必须遵守的强制风格：

- **import 顺序分组**，组间必须空行（`newlines-between: "always"`）。参考 `App.tsx` 顶部：react → 页面 → 布局 → utils。
- **每个 `return` 前空一行**、声明块后空行（`padding-line-between-statements`）。
- `react/jsx-sort-props`（warn）：回调最后、简写在前、保留字最先。
- `no-console: "warn"` —— 新代码别加 console，存量 ~30 处是历史遗留。

已知关闭的规则（意味着责任转移到人）：

- **`react-hooks/exhaustive-deps: "off"`** —— 依赖数组不全不会报警。写 useEffect 时自查闭包，尤其是"首加载 + 轮询/WS"组合。
- Prettier 经 eslint-plugin-prettier 集成（warn 级），**没有独立 .prettierrc**，格式问题跑 lint --fix。

## 依赖纪律

依赖里有一批**装了但没人用**的死依赖，不要"顺手"用起来：

| 死依赖 | 该用的替代 |
|---|---|
| `sonner` | toast 一律 `react-hot-toast` |
| `react-beautiful-dnd`(+types) | 拖拽一律 `@dnd-kit/*`（参考 `pages/forward.tsx`） |
| `framer-motion`（直接 import 场景） | HeroUI 的 peer 依赖，别显式 import |
| `@nextui-org/system` | 旧包名，组件统一从 `@heroui/*` 按包引入 |

**没有 lockfile**，Docker 构建用 `npm install --legacy-peer-deps`（peer 冲突是已知状态）。加新依赖时确认它不会加剧 peer 冲突，并优先按包名引入 HeroUI 子包（`@heroui/modal`）而不是主包。

## 构建与部署的坑

- `vite.config.ts`：`minify: false` + `treeshake: false` 是**刻意的**（产物保持可读，便于线上排查），别"优化"掉。
- Tailwind v4 混合模式：`globals.css` 用 `@import "tailwindcss"` + `@config "../../tailwind.config.js"`。content 扫描范围只含 `src/layouts`、`src/pages`、`src/components` —— **在这些目录之外写 Tailwind class 不会被编译出来**。
- `nginx.conf` 只反代 `/api/v1/`、`/flow/upload`、`/flow/config`，WS 升级只配了 `/system-info`。后端新增非 `/api/v1/` 前缀的端点时必须同步改 nginx.conf，否则线上 404（本地 dev 直连 6365 不会暴露这个问题）。
- Dockerfile 多阶段、`--platform=$BUILDPLATFORM`（amd64 原生跑构建再交叉出双架构）、`NODE_OPTIONS=--max-old-space-size=2048` 防 OOM —— 改构建流程时别丢这几个参数。

## UI 文案与注释语言

- UI 文案全部**硬编码中文**（含 toast、空状态、emoji 标题），无 i18n 框架。新文案照此风格。
- 注释用中文，且本项目注释的house style是**解释为什么/踩过的坑**，不是复述代码——参考 `utils/clipboard.ts`（剪贴板 vs 弹窗 focus-trap）、`config/sni.ts`（Reality SNI 的坑，"已经踩过一次"）、`api/network.ts` 的 SLOW_PATHS 注释。
- 写注释前先确认它说的是真的：`utils/logout.ts` 的 docblock 声称保留主题偏好、实现却是 `localStorage.clear()`——注释与实现不符比没注释更糟。
