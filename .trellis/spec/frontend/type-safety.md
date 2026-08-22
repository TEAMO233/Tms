# 类型安全

> tsconfig 开了 `strict` + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`，路径别名 `@/* → ./src/*`（`vite.config.ts` 同步配置）。`npm run build` = `tsc && vite build`，类型错误会直接挂构建——tsc 就是本项目的类型关卡。

## 类型放哪

- 领域模型放 `src/types/index.ts`（`User`、`UserTunnel`、`Tunnel`、`SpeedLimit`、`Pagination` 等，字段带中文注释）。
- API 响应包装 `ApiResponse<T>` 定义在 `src/api/network.ts`（不在 types/ 里）。
- vendored 全局 SDK 用全局声明：`types/tac.d.ts` 里 `declare class TAC` + `Window` 增强。

## 新代码的类型要求

现状里 `any` 很多（~108 处，重灾区 relay.tsx/inbound.tsx/forward.tsx），这是历史宽容度，但**新代码要守住底线**：

1. 新接口函数的入参/返回至少给个 interface，别裸 `any`：
   ```ts
   export const createFoo = (data: FooForm) => Network.post<Foo>('/foo/create', data);
   ```
2. **先查 `types/index.ts` 再定义类型**——历史上同一个 `Tunnel` 被 pages/tunnel.tsx、pages/limit.tsx、pages/forward.tsx 和 types/index.ts 各声明了一遍，`Forward` 在两处声明且字段还不一致。这是明确的反模式：改字段时漏一处就是线上 bug。遇到重复声明的旧代码，顺手收敛到 types/index.ts 并 import。
3. 判断后端返回的可选字段时留意 `0` 是 falsy 的坑：需要区分"没有"和"0"时用显式比较（`my-sub.tsx` 里 `!!account` 的注释解释过 `0 && ...` 会渲染出字面量 "0" 的问题）。

## 校验边界

前端类型只约束编译期；后端响应实际形状以运行时为准（`res.data` 出来后该判空判空）。不要为了"更安全"引入 zod 之类的运行时校验库，除非团队决策。
