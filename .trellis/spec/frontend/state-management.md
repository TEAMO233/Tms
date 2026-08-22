# 状态管理

> **没有** redux/zustand/jotai。全局状态 = localStorage 键 + 模块级单例 + window 自定义事件。这是刻意保持的简单结构，新增全局状态时先看本文的既有机制够不够用。

## 登录态（localStorage 四键）

登录成功后写入四个键（`pages/index.tsx` 的 `performLogin()`）：

| 键 | 含义 |
|---|---|
| `token` | JWT，请求时裸 header 携带（见 [api-networking](./api-networking.md)） |
| `role_id` | 角色 |
| `name` | 用户名 |
| `admin` | 管理员标记 |

读取统一走 `utils/auth.ts`（`isLoggedIn`/`isAdmin`）；JWT exp 解析在 `utils/jwt.ts`（纯客户端校验，仅用于路由跳转，安全边界在后端）。

**没有 refresh token 机制**：token 过期 → 清键 → 硬跳 `/`（`api/network.ts` 的 `handleTokenExpired`）。

登出注意：`utils/logout.ts` 的 `safeLogout()` 实际就是 `localStorage.clear()`——会把皮肤偏好 `skin` 也一起清掉（docblock 与实现不符是已知历史问题）。涉及登出逻辑改动时要意识到这一点。

## Provider 栈（src/provider.tsx）

```
I18nProvider(locale="zh-CN")   ← @react-aria/i18n，只是给 HeroUI 定 locale
 └─ HeroUIProvider             ← 接了 router 的 navigate/useHref
     └─ ThemeProvider          ← components/theme-provider.tsx，挂载时恢复皮肤，不跟随系统深浅色
         └─ <Toaster/>         ← react-hot-toast，顶部居中，2s
```

## 皮肤/主题

- 14 套皮肤定义在 `config/skins.ts`；`applySkin(id)` 切换 `<html>` 上的 `<skin-id>` 和 `dark` class，持久化到 `localStorage.skin`。
- 渐变背景等每皮肤的固定样式在 `styles/themes.css`，以 `html.<skin-id>` 选择器 + `!important` 实现。

## 跨组件通信：window 事件

站点配置更新用自定义事件广播，订阅方刷新侧边栏标题等：

```ts
// src/config/site.ts
window.dispatchEvent(new Event(SITE_CONFIG_UPDATED));
```

需要"改了 A 处、B 处要跟着变"且不想引状态库时，沿用这个模式（事件常量集中在 `config/site.ts`）。

## WebSocket（唯一实例）

`pages/node.tsx` 手写了原生 WebSocket 连 `/system-info?type=0&secret=<token>`（token 在 query 上），手动重连计数上限 5 次，连接存 `useRef`。要加实时功能时参考该实现；token 在 URL 上是已知取舍，别在别处复制这种做法传递敏感信息。

## 反模式

- 不要为了"更现代"引入状态库——现有页面间数据流全靠 props + localStorage + 事件，混入 store 会造成两套真相。
- 不要绕过 `utils/auth.ts` 直接读 localStorage 判断登录态（401 清键逻辑只保证那四个键的一致性）。
