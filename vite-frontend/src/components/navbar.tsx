import { useEffect, useState } from "react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";

import { getCachedConfig, siteConfig } from "@/config/site";
import { isWebViewFunc } from "@/utils/panel";

export function Navbar() {
  const navigate = useNavigate();
  const [appName, setAppName] = useState(siteConfig.name);
  const [isWebView, setIsWebView] = useState(false);

  useEffect(() => setIsWebView(isWebViewFunc()), []);

  useEffect(() => {
    const syncName = async () => {
      try {
        const cachedAppName = await getCachedConfig("app_name");

        if (cachedAppName) {
          setAppName(cachedAppName);
          siteConfig.name = cachedAppName;
        }
      } catch (error) {
        console.warn("更新配置失败:", error);
      }
    };
    const timer = window.setTimeout(syncName, 100);

    window.addEventListener("configUpdated", syncName);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("configUpdated", syncName);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          aria-label={`${appName} 首页`}
          className="flex min-w-0 items-center gap-2.5 text-zinc-900 dark:text-zinc-100"
          to="/"
        >
          <img
            alt=""
            className="h-8 w-8 rounded-lg object-contain"
            src="/favicon.ico"
          />
          <span className="truncate text-sm font-semibold tracking-tight">
            {appName}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {isWebView && (
            <button
              aria-label="面板设置"
              className="grid h-10 w-10 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="面板设置"
              type="button"
              onClick={() => navigate("/settings")}
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
