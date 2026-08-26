import { tv } from "tailwind-variants";

export const title = tv({
  base: "inline font-semibold tracking-tight text-zinc-900",
  variants: {
    color: {
      violet: "text-blue-600",
      yellow: "text-amber-600",
      blue: "text-blue-600",
      cyan: "text-cyan-600",
      green: "text-emerald-600",
      pink: "text-rose-600",
      foreground: "text-zinc-900",
    },
    size: {
      sm: "text-2xl",
      md: "text-3xl",
      lg: "text-3xl",
    },
    fullWidth: {
      true: "block w-full",
    },
  },
  defaultVariants: {
    color: "foreground",
    size: "md",
  },
});
