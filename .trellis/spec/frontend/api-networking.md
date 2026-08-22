# API 与网络层

> 所有后端通信走 `src/api/network.ts` 的 `Network.get/post<T>`，接口清单集中在 `src/api/index.ts`。改网络层前必读本文。

## 核心约定（来自 `src/api/network.ts`）

### 一律 POST

业务接口**全部用 POST**（包括列表、删除），GET 仅极少数场景。`api/index.ts` 顶部注释明确写着"全部使用POST请求"。新增接口默认 `Network.post`。

### 响应包装与错误处理

```ts
interface ApiResponse<T = any> { code: number; msg: string; data: T; }
```

- **Network 永不 reject**：任何异常都 resolve 成 `{ code: -1, msg: error.message || "网络请求失败", data: null }`。
- 调用方自己判断并 toast：

```ts
const res = await getUserList(data);
if (res.code === 0) { /* ... */ } else { toast.error(res.msg || '加载转发机列表失败'); }
```

- **不要**在调用处 try/catch Network 调用 —— catch 不到任何东西。

### 认证

- token 存 `localStorage.token`，每次请求以裸 header 携带：`"Authorization": window.localStorage.getItem('token')`（**无 Bearer 前缀**，与后端约定一致）。
- token 失效双通道检测（`isTokenExpired` + HTTP 401）：命中即清掉 `token/role_id/name` 并硬跳 `/`（`handleTokenExpired`）。注意 body 判定依赖三条**精确匹配的中文 msg**——后端若改动这三条消息文案，前端会失去自动登出能力，两边要同步改。

### baseURL

- 非 WebView 环境：`VITE_API_BASE` 非空则 `${VITE_API_BASE}/api/v1/`，否则同源 `/api/v1/`（生产 nginx 反代到 `http://backend:6365`，见 `nginx.conf`）。
- Android/iOS WebView 壳：原生侧注入面板地址列表，通过 `(window as any).setAddresses` 回调设置 baseURL（`utils/panel.ts` 的 JsInterface/webkit 桥）。

### 超时与慢接口

默认 30s。需要与节点往返的接口（下发 gost 服务、推限速器，单次节点往返最多 10s）列入 `SLOW_PATHS`，放宽到 180s。`SLOW_PATHS` 上方有大段中文注释解释缘由。**新增与节点通信的接口时必须把它加进 `SLOW_PATHS`**，否则用户会看到莫名的 timeout。

## 新增接口的标准动作

1. 在 `src/api/index.ts` 对应领域注释块下加箭头函数：
   ```ts
   // xxxCRUD -----------------
   export const createFoo = (data: FooForm) => Network.post<Foo>('/foo/create', data);
   ```
2. 路径以 `/` 开头，动词后置（`/forward/create`、`/node/install` 风格）。
3. 与节点交互的路径同步加入 `network.ts` 的 `SLOW_PATHS`。
4. 页面调用处按 `res.code === 0` 分支，失败 `toast.error(res.msg || '<中文兜底文案>')`。

## 反模式

- 不要绕过 `Network` 直接 import axios 发请求（全局 baseURL/token 注入都会被绕过）。
- 不要给 Authorization 加 Bearer 前缀，不要改成 axios interceptor 注入 —— 现状是每请求显式带 header，WebView 场景依赖这个简单结构。
- `sonner` 在依赖里但**没人用**，toast 统一用 `react-hot-toast`。
