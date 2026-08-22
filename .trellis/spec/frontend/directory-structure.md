# 前端目录结构（vite-frontend）

> 技术栈：React 18.3 + TypeScript 5.6(strict) + Vite 5 + Tailwind v4 + HeroUI v2 + react-router-dom v6。
> 无状态管理库、无 i18n 框架、无测试框架 —— 这是现状约定，不要擅自引入。

## 目录布局

```
vite-frontend/src/
├── api/
│   ├── network.ts      # axios 封装：Network.get/post<T>，唯一出口
│   └── index.ts        # 全部后端接口，一个接口 = 一个箭头函数导出
├── components/         # ≥2 个页面共用的组件（navbar/page-wrapper/sub-qr/skin-picker…）
├── config/             # site.ts(站点配置+localStorage 缓存)、skins.ts(14套皮肤)、sni.ts
├── images/             # 静态图片
├── layouts/            # default/admin/h5/h5-simple，全部 default export
├── pages/              # 一个路由 = 一个文件，kebab-case 命名（forward.tsx/user.tsx…）
├── styles/             # globals.css(移动端适配)、themes.css(皮肤渐变)
├── types/              # index.ts(领域模型)、tac.d.ts(vendored 验证码 SDK 全局声明)
└── utils/              # auth.ts/jwt.ts/logout.ts/panel.ts/clipboard.ts —— 纯函数
```

## 放置规则（按真实代码归纳）

| 要加的东西 | 放哪 | 依据 |
|---|---|---|
| 新页面/路由 | `src/pages/<kebab-case>.tsx`，并在 `src/App.tsx` 的 `<Routes>` 里注册、包 `<ProtectedRoute>` | `src/App.tsx` |
| 页面布局选择 | 不用嵌套路由，通过 `<ProtectedRoute>` 的 props（`useSimpleLayout`/`skipLayout`）按路由指定 layout | `src/App.tsx` |
| 跨页面复用的组件 | `src/components/` | navbar、page-wrapper 等 |
| 只在一个页面用的弹窗/卡片 | **留在页面文件内部**定义（本项目的惯例就是页内内联） | `pages/user.tsx` 等大页面 |
| 共享逻辑 | `src/utils/*.ts`，纯函数。**项目没有 `src/hooks/` 目录**，不要新建 | `utils/auth.ts` |
| 新后端接口 | `src/api/index.ts` 里加一个箭头函数导出，按领域注释分节 | `api/index.ts` |

## 路由与守卫

- 扁平 `<Routes>`（15 条），全部静态 import，**不做懒加载** —— 保持现状。
- 登录守卫 = `App.tsx` 内部的 `ProtectedRoute`：检查 `isLoggedIn()`（`utils/jwt.ts` 客户端解析 JWT exp），未登录 redirect 到 `/`。
- H5 判定（`useH5Mode`）：宽度 ≤768 或 移动 UA 或 `?h5=true`。
- 角色控制是**展示层**的：菜单项带 `adminOnly: true`、路由元素里 `isAdmin() ? <X/> : <Navigate to="/my-sub"/>`。真正的权限校验在后端 —— 前端只藏入口，别指望前端拦住人。

## 反模式（现有代码里的教训，别扩散）

- `pages/forward.tsx` 已 2372 行、`user.tsx` 1600 行 —— 单文件巨页是历史包袱。新功能如果让某个页面再涨几百行，优先把独立弹窗抽成页内子组件或 `components/` 组件，但**不要**为了重构而大规模搬移旧代码。
- 不要引入 `src/hooks/`、redux/zustand、i18n 库 —— 与现状架构冲突。
