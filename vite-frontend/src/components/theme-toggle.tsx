import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "切换为浅色" : "切换为暗色";

  return (
    <button
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${className}`.trim()}
      title={label}
      type="button"
      onClick={toggleTheme}
    >
      {isDark ? (
        <SunIcon aria-hidden className="h-5 w-5" />
      ) : (
        <MoonIcon aria-hidden className="h-5 w-5" />
      )}
    </button>
  );
}
