import { useEffect, useState } from "react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";

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
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          aria-label={`${appName} 首页`}
          className="flex min-w-0 items-center gap-3 text-zinc-900"
          to="/"
        >
          <img
            alt=""
            className="h-9 w-9 rounded-lg object-contain"
            src="/favicon.ico"
          />
          <span className="truncate text-base font-semibold tracking-tight">
            {appName}
          </span>
        </Link>

        {isWebView && (
          <button
            aria-label="面板设置"
            className="grid h-10 w-10 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            title="面板设置"
            type="button"
            onClick={() => navigate("/settings")}
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
