import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "@/layouts/admin";
import { isProtocolDesignPreview } from "@/config/design-preview";
import { getCachedConfig, siteConfig } from "@/config/site";
import { isAdmin, isLoggedIn } from "@/utils/auth";

const IndexPage = lazy(() => import("@/pages/index"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ForwardPage = lazy(() => import("@/pages/forward"));
const TunnelPage = lazy(() => import("@/pages/tunnel"));
const NodePage = lazy(() => import("@/pages/node"));
const UserPage = lazy(() => import("@/pages/user"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const LimitPage = lazy(() => import("@/pages/limit"));
const InboundPage = lazy(() => import("@/pages/inbound"));
const RelayPage = lazy(() => import("@/pages/relay"));
const TransparentRelayPage = lazy(() => import("@/pages/transparent-relay"));
const GuidePage = lazy(() => import("@/pages/guide"));
const MySubPage = lazy(() => import("@/pages/my-sub"));
const ConfigPage = lazy(() => import("@/pages/config"));
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((module) => ({
    default: module.SettingsPage,
  })),
);

const isDesignPreview = isProtocolDesignPreview();

function PageFallback() {
  return (
    <div className="page-loading min-h-[360px] bg-[var(--tms-bg)]">
        <span aria-hidden="true" className="loading-spinner" />
        正在加载页面…
    </div>
  );
}

function ProtectedRoute({
  children,
  requiresAdmin = false,
  skipLayout = false,
}: {
  children: ReactNode;
  requiresAdmin?: boolean;
  skipLayout?: boolean;
}) {
  const authenticated = isLoggedIn() || isDesignPreview;
  const hasAdminAccess = isAdmin() || isDesignPreview;

  if (!authenticated) return <Navigate replace to="/" />;
  if (requiresAdmin && !hasAdminAccess)
    return <Navigate replace to="/my-sub" />;
  if (skipLayout) return <>{children}</>;

  return <AdminLayout>{children}</AdminLayout>;
}

function LoginRoute() {
  if (!isLoggedIn()) return <IndexPage />;

  return <Navigate replace to={isAdmin() ? "/dashboard" : "/my-sub"} />;
}

const protectedPages = [
  { path: "/dashboard", element: <DashboardPage />, requiresAdmin: true },
  { path: "/forward", element: <ForwardPage /> },
  { path: "/inbound", element: <InboundPage /> },
  { path: "/relay", element: <RelayPage /> },
  { path: "/transparent-relay", element: <TransparentRelayPage /> },
  { path: "/guide", element: <GuidePage /> },
  { path: "/my-sub", element: <MySubPage /> },
  { path: "/tunnel", element: <TunnelPage /> },
  { path: "/node", element: <NodePage /> },
  { path: "/user", element: <UserPage /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/limit", element: <LimitPage /> },
  { path: "/config", element: <ConfigPage /> },
];

export default function App() {
  useEffect(() => {
    document.title = siteConfig.name;

    const timer = window.setTimeout(async () => {
      try {
        const cachedAppName = await getCachedConfig("app_name");

        if (cachedAppName) document.title = cachedAppName;
      } catch (error) {
        console.warn("检查标题更新失败:", error);
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<LoginRoute />} path="/" />
        <Route
          element={
            <ProtectedRoute skipLayout>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
          path="/change-password"
        />
        {protectedPages.map((page) => (
          <Route
            key={page.path}
            element={
              <ProtectedRoute requiresAdmin={page.requiresAdmin}>
                {page.element}
              </ProtectedRoute>
            }
            path={page.path}
          />
        ))}
        <Route element={<SettingsPage />} path="/settings" />
        <Route
          element={
            <Navigate
              replace
              to={isLoggedIn() ? (isAdmin() ? "/dashboard" : "/my-sub") : "/"}
            />
          }
          path="*"
        />
      </Routes>
    </Suspense>
  );
}
