# 组件规范

## 基本形态

- **只用函数组件**，全库零 class 组件。
- **页面与布局：default export**（`export default function IndexPage() {}`）。唯一例外 `pages/settings.tsx` 用了具名导出——是历史不一致，新代码别学。
- 共享组件（`src/components/`）两种都有：`SubQr`/`Navbar` 具名导出，`PageWrapper`/`SkinPicker` default 导出。跟随所在文件现状即可。
- Props 类型：小组件内联对象类型，大组件 `interface XxxProps`：

```ts
// src/components/page-wrapper.tsx
interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}
```

## 表单（无表单库，手写受控）

项目**不用** react-hook-form/formik。标准模式 = 表单状态对象 + Partial 错误对象 + 手写校验函数：

```ts
// src/pages/index.tsx
const [form, setForm] = useState<LoginForm>({ username: "", password: "", captchaId: "" });
const [errors, setErrors] = useState<Partial<LoginForm>>({});
const validateForm = (): boolean => { /* ... */ setErrors(newErrors); return Object.keys(newErrors).length === 0; };
```

- 输入错误态用 HeroUI 的 `isInvalid`/`errorMessage`。
- HeroUI 按钮事件用 **`onPress`** 不是 `onClick`（较新代码的统一写法）。
- 提交前先 `validateForm()`，通过才调 API。

## 弹窗

两种并存的主流写法：

1. **useState 布尔**（页面里的绝对主流）：`const [assignOpen, setAssignOpen] = useState(false);`
2. `useDisclosure()`（来自 `@heroui/modal`）：见 `layouts/admin.tsx`、`pages/profile.tsx`。

同一个页面里保持一种；新页面默认用 useState 布尔。弹窗结构统一 `<Modal isOpen onClose><ModalContent>…`。没有 Drawer 组件。

## 样式

- ~100% Tailwind 工具类直接写在 JSX 上；仅计算值（进度条宽度、暗色滤镜）用内联 `style={{...}}`。不用 CSS Modules。
- 颜色优先 HeroUI 语义类（`text-default-500`、`bg-danger/5`、`text-primary`），与裸 Tailwind 灰阶混用是常态。
- 深色模式全部走 `dark:` 变体（`darkMode: "class"`，由皮肤切换控制）。
- 注意 Tailwind content 扫描范围只覆盖 `layouts/pages/components`（见 [quality-guidelines](./quality-guidelines.md)）。

## 文案与数据展示细节

- UI 文案硬编码中文，空状态、toast 都要给中文文案。
- 渲染可能为 `0` 的数值时防 falsy 坑（参考 `my-sub.tsx` 的 `!!account` 注释）。

## 反模式

- 别把页面继续吹成 2000+ 行巨石（forward.tsx 是历史包袱不是榜样）；新功能至少按"弹窗/卡片拆成页内子组件"组织。
- 不要引入新的 UI 库或图标方案；图标在 `components/icons`，组件从 `@heroui/*` 按需引。
