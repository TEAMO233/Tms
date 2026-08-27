import type { NavigationItem } from "@/config/navigation";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CheckCircleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  CommandLineIcon,
  KeyIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { BoltIcon } from "@heroicons/react/24/solid";
import { toast } from "react-hot-toast";

import { getVersionInfo, updatePassword } from "@/api";
import {
  isProtocolDesignPreview,
  withDesignPreview,
} from "@/config/design-preview";
import {
  canShowNavigationItem,
  navigationGroups,
  secondaryNavigation,
} from "@/config/navigation";
import { SITE_CONFIG_UPDATED, siteConfig } from "@/config/site";
import { isAdmin as getIsAdmin } from "@/utils/auth";
import { copyTextToClipboard } from "@/utils/clipboard";
import { safeLogout } from "@/utils/logout";

const isDesignPreview = isProtocolDesignPreview();

interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface VersionInfo {
  panelVersion?: string;
  commit?: string;
  latest?: string;
  updateAvailable?: boolean;
}

const SIDEBAR_STORAGE_KEY = "tms_sidebar_collapsed";

function NavigationLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`admin-nav-item group flex w-full items-center px-2.5 font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      } ${collapsed ? "admin-nav-item--collapsed justify-center" : "gap-2.5"}`}
      title={collapsed ? item.label : undefined}
      type="button"
      onClick={() => onNavigate(item.path)}
    >
      <Icon
        aria-hidden
        className={`h-[18px] w-[18px] shrink-0 ${active ? "text-blue-600" : "text-zinc-500 group-hover:text-zinc-700"}`}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const passwordModal = useDisclosure();
  const updateModal = useDisclosure();

  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
  );
  const [username, setUsername] = useState("");
  const [admin, setAdmin] = useState(false);
  const [appName, setAppName] = useState(siteConfig.name);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newUsername: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileMenuOpen(false);
    };

    syncViewport();
    media.addEventListener("change", syncViewport);

    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const currentAdmin = isDesignPreview || getIsAdmin();

    setAdmin(currentAdmin);
    setUsername(
      isDesignPreview ? "teamo" : localStorage.getItem("name") || "Admin",
    );
  }, []);

  useEffect(() => {
    const updateName = () => setAppName(siteConfig.name);

    window.addEventListener(SITE_CONFIG_UPDATED, updateName);

    return () => window.removeEventListener(SITE_CONFIG_UPDATED, updateName);
  }, []);

  useEffect(() => {
    if (!admin) return;

    getVersionInfo()
      .then((response) => {
        if (response.code === 0) setVersionInfo(response.data as VersionInfo);
      })
      .catch(() => undefined);
  }, [admin]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            canShowNavigationItem(item, admin),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [admin],
  );

  const visibleSecondary = useMemo(
    () =>
      secondaryNavigation.filter((item) => canShowNavigationItem(item, admin)),
    [admin],
  );

  const toggleCollapsed = () => {
    const next = !collapsed;

    setCollapsed(next);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  };

  const handleLogout = () => {
    safeLogout();
    navigate("/");
  };

  const handleNavigate = (path: string) => {
    navigate(withDesignPreview(path));
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      newUsername: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const validatePasswordForm = () => {
    if (passwordForm.newUsername.trim().length < 3) {
      toast.error("新用户名至少需要 3 位");
      return false;
    }
    if (!passwordForm.currentPassword) {
      toast.error("请输入当前密码");
      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("新密码至少需要 6 位");
      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return false;
    }

    return true;
  };

  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      const response = await updatePassword(passwordForm);

      if (response.code === 0) {
        toast.success("密码修改成功，请重新登录");
        passwordModal.onClose();
        handleLogout();
      } else {
        toast.error(response.msg || "密码修改失败");
      }
    } catch {
      toast.error("修改密码时发生错误");
    } finally {
      setPasswordLoading(false);
    }
  };

  const sidebarWidth = collapsed && !isMobile ? "w-[72px]" : "w-56";
  const contentOffset = collapsed ? "lg:pl-[72px]" : "lg:pl-56";

  return (
    <div className="admin-shell min-h-screen bg-[#fafafa] text-zinc-900">
      {isMobile && mobileMenuOpen && (
        <button
          aria-label="关闭导航菜单"
          className="fixed inset-0 z-40 cursor-default bg-zinc-950/30"
          type="button"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        aria-label="主导航"
        className={`fixed inset-y-0 left-0 z-50 flex ${sidebarWidth} flex-col border-r border-zinc-200 bg-white transition-[width,transform] duration-150 ${
          isMobile && !mobileMenuOpen ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <div
          className={`flex h-14 shrink-0 items-center border-b border-zinc-100 px-3 ${
            collapsed && !isMobile ? "justify-center" : "gap-2.5"
          }`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <BoltIcon aria-hidden className="h-5 w-5" />
          </span>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                {isDesignPreview ? "TunnelBox" : appName}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                v{versionInfo?.panelVersion || siteConfig.version}
                {versionInfo?.commit && versionInfo.commit !== "dev"
                  ? `-${versionInfo.commit}`
                  : ""}
              </p>
            </div>
          )}
          {isMobile && (
            <button
              aria-label="关闭导航菜单"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              type="button"
              onClick={() => setMobileMenuOpen(false)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {!collapsed || isMobile ? (
                  <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-zinc-400">
                    {group.label}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavigationLink
                      key={item.path}
                      active={location.pathname === item.path}
                      collapsed={collapsed && !isMobile}
                      item={item}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-zinc-100 p-2.5">
          <div className="space-y-1">
            {visibleSecondary.map((item) => (
              <NavigationLink
                key={item.path}
                active={location.pathname === item.path}
                collapsed={collapsed && !isMobile}
                item={item}
                onNavigate={handleNavigate}
              />
            ))}
          </div>

          <div
            className={`mt-3 border-t border-zinc-100 pt-3 ${
              collapsed && !isMobile ? "grid justify-items-center" : ""
            }`}
          >
            <button
              className={`flex w-full items-center rounded-lg p-2 text-left transition-colors duration-150 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                collapsed && !isMobile ? "justify-center" : "gap-3"
              }`}
              title={collapsed && !isMobile ? username : undefined}
              type="button"
              onClick={() => handleNavigate("/profile")}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                {username.slice(0, 1).toUpperCase()}
              </span>
              {(!collapsed || isMobile) && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">
                    {username}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="status-dot bg-emerald-500" />
                    {admin ? "管理员" : "用户"}
                  </span>
                </span>
              )}
            </button>

            {!isMobile && (
              <button
                aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
                className={`mt-1.5 flex min-h-9 w-full items-center rounded-lg px-2.5 text-[13px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                  collapsed ? "justify-center" : "gap-2.5"
                }`}
                title={collapsed ? "展开侧边栏" : undefined}
                type="button"
                onClick={toggleCollapsed}
              >
                {collapsed ? (
                  <ChevronDoubleRightIcon className="h-5 w-5" />
                ) : (
                  <>
                    <ChevronDoubleLeftIcon className="h-5 w-5" />
                    <span>收起菜单</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-150 ${contentOffset}`}
      >
        <header className="admin-topbar sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="打开导航菜单"
              className="grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 lg:hidden"
              type="button"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="mr-2 hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
              <span className="status-dot bg-emerald-500" />
              系统运行正常
            </div>
            {admin && versionInfo?.updateAvailable && (
              <Button
                className="rounded-lg text-sm font-medium text-amber-700 transition-colors"
                size="sm"
                variant="light"
                onPress={updateModal.onOpen}
              >
                有新版本
              </Button>
            )}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  className="h-9 min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-700 shadow-none transition-colors hover:bg-zinc-50"
                  variant="flat"
                >
                  <UserCircleIcon className="h-5 w-5 text-blue-500" />
                  <span className="hidden max-w-28 truncate sm:inline">
                    {username}
                  </span>
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="用户菜单">
                <DropdownItem
                  key="change-password"
                  startContent={<KeyIcon className="h-4 w-4" />}
                  onPress={passwordModal.onOpen}
                >
                  修改密码
                </DropdownItem>
                <DropdownItem
                  key="logout"
                  className="text-danger"
                  color="danger"
                  startContent={
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  }
                  onPress={handleLogout}
                >
                  退出登录
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </header>

        <main className="app-main min-h-[calc(100vh-var(--tms-topbar))] bg-[#fafafa]">
          {children}
        </main>
      </div>

      <Modal
        isOpen={passwordModal.isOpen}
        placement="center"
        size="lg"
        onOpenChange={(open) => {
          if (!open) resetPasswordForm();
          passwordModal.onOpenChange();
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>修改密码</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    label="新用户名"
                    placeholder="至少 3 位"
                    value={passwordForm.newUsername}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newUsername: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="当前密码"
                    placeholder="输入当前密码"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="新密码"
                    placeholder="至少 6 位"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="确认新密码"
                    placeholder="再次输入新密码"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="rounded-lg text-sm font-medium transition-colors"
                  variant="light"
                  onPress={onClose}
                >
                  取消
                </Button>
                <Button
                  className="rounded-lg bg-blue-500 text-sm font-medium text-white transition-colors"
                  isLoading={passwordLoading}
                  onPress={handlePasswordSubmit}
                >
                  确认修改
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={updateModal.isOpen}
        size="md"
        onOpenChange={updateModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>发现新版本</ModalHeader>
              <ModalBody>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <span className="text-zinc-500">当前版本</span>
                    <span className="font-mono text-zinc-900">
                      v{versionInfo?.panelVersion || siteConfig.version}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">最新版本</span>
                    <span className="font-mono text-blue-600">
                      {versionInfo?.latest || "-"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="mb-2 text-xs text-zinc-500">
                      在面板服务器执行
                    </p>
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="h-5 w-5 text-zinc-500" />
                      <code className="min-w-0 flex-1 select-all font-mono text-zinc-900">
                        tms update
                      </code>
                      <Button
                        className="rounded-lg text-sm font-medium transition-colors"
                        size="sm"
                        variant="flat"
                        onPress={async () => {
                          const copied =
                            await copyTextToClipboard("tms update");
                          copied
                            ? toast.success("已复制")
                            : toast.error("复制失败");
                        }}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                  <p className="flex items-start gap-2 text-xs leading-5 text-zinc-500">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    更新会重启面板约 1–2 分钟，节点和既有订阅链接不受影响。
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  className="rounded-lg bg-blue-500 text-sm font-medium text-white transition-colors"
                  onPress={onClose}
                >
                  知道了
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
