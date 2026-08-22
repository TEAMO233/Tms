# 前端规范（vite-frontend）

> React 18.3 + TypeScript 5.6(strict) + Vite 5 + Tailwind v4(混合模式) + HeroUI v2 + react-router-dom v6。
> 面板 Web UI，同时被 android-app / ios-app 以 WebView 壳内嵌（原生侧注入面板地址，见 `utils/panel.ts` 桥接）。

## 写代码前检查清单

- [ ] 新页面？→ `pages/<kebab-case>.tsx` + `App.tsx` 注册进 `<ProtectedRoute>`（布局用 props 选，不嵌套路由）
- [ ] 新接口？→ `api/index.ts` 加箭头函数，一律 POST；与节点往返的路径加进 `network.ts` 的 `SLOW_PATHS`
- [ ] 类型先查 `types/index.ts`，别再复制一份 interface
- [ ] toast 用 `react-hot-toast`；拖拽用 `@dnd-kit`；别碰依赖里的死包（sonner/react-beautiful-dnd/@nextui-org/system）
- [ ] 后端端点不在 `/api/v1/|/flow/*|/system-info` 里 → 同步改 `nginx.conf`
- [ ] 完成后跑：`npm run lint && npm run build`

## 文档索引

| 文档 | 内容 |
|------|------|
| [directory-structure.md](./directory-structure.md) | 目录布局、放置规则、路由守卫、H5 判定 |
| [api-networking.md](./api-networking.md) | Network 封装、ApiResponse、认证头、SLOW_PATHS 超时 |
| [component-guidelines.md](./component-guidelines.md) | 函数组件、手写表单、弹窗两种写法、Tailwind/HeroUI 样式 |
| [state-management.md](./state-management.md) | localStorage 四键、provider 栈、皮肤系统、window 事件、WebSocket |
| [type-safety.md](./type-safety.md) | strict 配置、类型放哪、any 的底线、重复声明的教训 |
| [quality-guidelines.md](./quality-guidelines.md) | lint/build 命令、ESLint 强制风格、依赖纪律、nginx/Dockerfile 的坑 |

## 本层现状速览（2026-08 归纳）

- 无状态库、无 i18n、无测试框架 —— 简单结构是刻意选择，引入新框架需团队决策。
- UI 文案硬编码中文；注释中文、以"解释为什么/踩坑史"为 house style。
- `exhaustive-deps` 被 lint 关闭，useEffect 闭包靠人肉自查。
- 构建产物刻意不压缩不摇树（线上排查友好），别当 bug 修。

**Language**: 本目录文档以中文书写，代码标识符保持英文。
