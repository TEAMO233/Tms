import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { getFlowStatisticsRange, getUserPackageInfo } from "@/api";
import type { FlowStatisticsResponse } from "@/types";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { isProtocolDesignPreview as getIsProtocolDesignPreview } from "@/config/design-preview";
import {
  buildFlowStatisticsRange,
  createLastDaysRange,
  createTodayRange,
  toFlowChartData,
  type FlowStatisticsDateRange,
} from "@/utils/dashboard-flow";

interface UserInfo {
  flow: number;
  inFlow: number;
  outFlow: number;
  num: number;
  expTime?: string;
  flowResetTime?: number;
}

interface UserTunnel {
  id: number;
  tunnelId: number;
  tunnelName: string;
  flow: number;
  inFlow: number;
  outFlow: number;
  num: number;
  expTime?: string;
  flowResetTime?: number;
  tunnelFlow: number;
}

interface Forward {
  id: number;
  name: string;
  tunnelId: number;
  tunnelName: string;
  inIp: string;
  inPort: number;
  remoteAddr: string;
  inFlow: number;
  outFlow: number;
  serviceRunning?: boolean;
}

interface AddressItem {
  id: number;
  ip: string;
  address: string;
  copying: boolean;
}

const isProtocolDesignPreview = getIsProtocolDesignPreview();

const warningToastIcon = (
  <ExclamationTriangleIcon className="h-5 w-5 text-white" />
);

const PREVIEW_USER_INFO: UserInfo = {
  flow: 99999,
  inFlow: 14.9 * 1024 * 1024 * 1024,
  outFlow: 2.08 * 1024 * 1024 * 1024,
  num: 99999,
  flowResetTime: 7,
};

const PREVIEW_FORWARDS: Forward[] = Array.from({ length: 14 }, (_, index) => {
  const inFlow = [127.33, 17.96, 982.33, 3.98, 615.45, 48.2, 238.1, 91.8][
    index % 8
  ];
  const outFlow = [488.12, 17.04, 58.44 * 1024, 8.04, 332.4, 61.2, 14.8, 102.4][
    index % 8
  ];

  return {
    id: index + 1,
    name: `inbound-${30 - index}-user-1`,
    tunnelId: 2,
    tunnelName: "inbound-tunnel-node2",
    inIp: "64.83.37.138",
    inPort: 20007 - index,
    remoteAddr: `127.0.0.1:${40005 - index}`,
    inFlow: inFlow * 1024,
    outFlow: outFlow * 1024,
    serviceRunning: true,
  };
});

const PREVIEW_FLOW_STATISTICS: FlowStatisticsResponse = {
  granularity: "hour",
  startTime: 0,
  endTime: 0,
  totalFlow: 8.74 * 1024 * 1024 * 1024,
  downloadFlow: 214.96 * 1024 * 1024,
  uploadFlow: 2.08 * 1024 * 1024 * 1024,
  points: [
    [0.02, 0.01, 0.01],
    [0.02, 0.01, 0.01],
    [0.03, 0.02, 0.01],
    [0.02, 0.01, 0.01],
    [0.03, 0.02, 0.01],
    [0.42, 0.04, 0.01],
    [0.02, 0.01, 0.01],
    [0.02, 0.01, 0.01],
    [0.58, 0.05, 0.01],
    [2.24, 0.12, 0.02],
    [0.88, 0.11, 0.02],
    [0.68, 0.1, 0.02],
    [0.48, 0.08, 0.02],
    [1.1, 0.08, 0.03],
    [0.06, 0.04, 0.05],
    [0.76, 0.08, 0.72],
    [1.18, 0.12, 1.06],
  ].map(([flow, downloadFlow, uploadFlow], index) => ({
    label: `${String(index).padStart(2, "0")}:00`,
    startTime: index,
    endTime: index + 1,
    flow: flow * 1024 * 1024 * 1024,
    downloadFlow: downloadFlow * 1024 * 1024 * 1024,
    uploadFlow: uploadFlow * 1024 * 1024 * 1024,
  })),
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo>(
    isProtocolDesignPreview ? PREVIEW_USER_INFO : ({} as UserInfo),
  );
  const [forwardList, setForwardList] = useState<Forward[]>(
    isProtocolDesignPreview ? PREVIEW_FORWARDS : [],
  );
  const [statisticsRange, setStatisticsRange] =
    useState<FlowStatisticsDateRange>(() => createTodayRange());
  const [appliedStatisticsRange, setAppliedStatisticsRange] =
    useState<FlowStatisticsDateRange>(() => createTodayRange());
  const [flowStatistics, setFlowStatistics] =
    useState<FlowStatisticsResponse | null>(
      isProtocolDesignPreview ? PREVIEW_FLOW_STATISTICS : null,
    );
  const [flowStatisticsLoading, setFlowStatisticsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState<
    "today" | "7d" | "30d" | "custom"
  >("today");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalTitle, setAddressModalTitle] = useState("");
  const [addressList, setAddressList] = useState<AddressItem[]>([]);

  // 检查有效期通知
  const checkExpirationNotifications = (
    userInfo: UserInfo,
    tunnels: UserTunnel[],
  ) => {
    // 避免重复通知，检查是否已经显示过
    const notificationKey = `expiration-${userInfo.expTime}-${tunnels.map((t) => t.expTime).join(",")}`;
    const lastNotified = localStorage.getItem("lastNotified");

    if (lastNotified === notificationKey) {
      return; // 已经通知过，不重复显示
    }

    let hasNotification = false;

    // 检查主账户有效期
    if (userInfo.expTime) {
      const expDate = new Date(userInfo.expTime);
      const now = new Date();

      if (!isNaN(expDate.getTime()) && expDate > now) {
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7 && diffDays > 0) {
          hasNotification = true;
          if (diffDays === 1) {
            toast("账户将于明天过期，请及时续费", {
              icon: warningToastIcon,
              duration: 6000,
              style: { background: "#f59e0b", color: "#fff" },
            });
          } else {
            toast(`账户将于${diffDays}天后过期，请及时续费`, {
              icon: warningToastIcon,
              duration: 6000,
              style: { background: "#f59e0b", color: "#fff" },
            });
          }
        } else if (diffDays <= 0) {
          hasNotification = true;
          toast("账户已过期，请立即续费", {
            icon: warningToastIcon,
            duration: 8000,
            style: { background: "#ef4444", color: "#fff" },
          });
        }
      }
    }

    // 检查隧道有效期
    tunnels.forEach((tunnel) => {
      if (tunnel.expTime) {
        const expDate = new Date(tunnel.expTime);
        const now = new Date();

        if (!isNaN(expDate.getTime()) && expDate > now) {
          const diffTime = expDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 7 && diffDays > 0) {
            hasNotification = true;
            if (diffDays === 1) {
              toast(`隧道"${tunnel.tunnelName}"将于明天过期`, {
                icon: warningToastIcon,
                duration: 5000,
                style: { background: "#f59e0b", color: "#fff" },
              });
            } else {
              toast(`隧道"${tunnel.tunnelName}"将于${diffDays}天后过期`, {
                icon: warningToastIcon,
                duration: 5000,
                style: { background: "#f59e0b", color: "#fff" },
              });
            }
          } else if (diffDays <= 0) {
            hasNotification = true;
            toast(`隧道"${tunnel.tunnelName}"已过期`, {
              icon: warningToastIcon,
              duration: 6000,
              style: { background: "#ef4444", color: "#fff" },
            });
          }
        }
      }
    });

    // 如果显示了通知，记录防止重复
    if (hasNotification) {
      localStorage.setItem("lastNotified", notificationKey);
    }
  };

  useEffect(() => {
    // 重置状态并加载数据，防止页面切换时显示旧数据
    setLoading(true);
    setUserInfo(isProtocolDesignPreview ? PREVIEW_USER_INFO : ({} as UserInfo));
    setForwardList(isProtocolDesignPreview ? PREVIEW_FORWARDS : []);
    setFlowStatistics(isProtocolDesignPreview ? PREVIEW_FLOW_STATISTICS : null);

    // 检查用户是否是管理员
    const adminStatus = localStorage.getItem("admin");
    setIsAdmin(isProtocolDesignPreview || adminStatus === "true");

    const today = createTodayRange();
    setStatisticsRange(today);
    setAppliedStatisticsRange(today);
    setActiveShortcut("today");
    loadPackageData();
    loadFlowStatistics(today);
    localStorage.setItem("e", "/dashboard");
  }, []);

  const loadPackageData = async () => {
    setLoading(true);
    if (isProtocolDesignPreview) {
      setUserInfo(PREVIEW_USER_INFO);
      setForwardList(PREVIEW_FORWARDS);
      setLoading(false);
      return;
    }

    try {
      const res = await getUserPackageInfo();
      if (res.code === 0) {
        const data = res.data;
        setUserInfo(data.userInfo || {});
        setForwardList(data.forwards || []);

        // 检查有效期并显示通知
        checkExpirationNotifications(
          data.userInfo,
          data.tunnelPermissions || [],
        );
      } else {
        toast.error(res.msg || "获取套餐信息失败");
      }
    } catch (error) {
      console.error("获取套餐信息失败:", error);
      toast.error("获取套餐信息失败");
    } finally {
      setLoading(false);
    }
  };

  const loadFlowStatistics = async (
    range: FlowStatisticsDateRange = statisticsRange,
  ) => {
    setFlowStatisticsLoading(true);
    if (isProtocolDesignPreview) {
      setFlowStatistics(PREVIEW_FLOW_STATISTICS);
      setAppliedStatisticsRange(range);
      setFlowStatisticsLoading(false);
      return;
    }

    try {
      const query = buildFlowStatisticsRange(range.startDate, range.endDate);
      const res = await getFlowStatisticsRange(query);
      if (res.code === 0) {
        setFlowStatistics(res.data || null);
        setAppliedStatisticsRange(range);
      } else {
        toast.error(res.msg || "获取流量统计失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取流量统计失败");
    } finally {
      setFlowStatisticsLoading(false);
    }
  };

  const applyStatisticsShortcut = (
    range: FlowStatisticsDateRange,
    shortcut: "today" | "7d" | "30d",
  ) => {
    setActiveShortcut(shortcut);
    setStatisticsRange(range);
    loadFlowStatistics(range);
  };

  const handleStatisticsQuery = () => {
    setActiveShortcut("custom");
    loadFlowStatistics(statisticsRange);
  };

  const formatFlow = (value: number, unit: string = "bytes"): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return "无限制";
    }

    if (unit === "gb") {
      return value + " GB";
    } else {
      if (value === 0) return "0 B";
      if (value < 1024) return value + " B";
      if (value < 1024 * 1024) return (value / 1024).toFixed(2) + " KB";
      if (value < 1024 * 1024 * 1024)
        return (value / (1024 * 1024)).toFixed(2) + " MB";
      return (value / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }
  };

  const formatNumber = (value: number): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return "无限制";
    }
    return value.toString();
  };

  // 处理流量统计数据：当天按小时,跨天按自然日,并拆分上传/下载
  const processFlowChartData = () =>
    toFlowChartData(flowStatistics?.points || []);

  const statisticsRangeText = `${appliedStatisticsRange.startDate} 至 ${appliedStatisticsRange.endDate}`;

  const calculateUserTotalUsedFlow = (): number => {
    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  };

  const calculateUsagePercentage = (type: "flow" | "forwards"): number => {
    if (type === "flow") {
      const totalUsed = calculateUserTotalUsedFlow();
      const totalLimit = (userInfo.flow || 0) * 1024 * 1024 * 1024;
      // 无限制时返回0%
      if (userInfo.flow === 99999) return 0;
      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    } else if (type === "forwards") {
      const totalUsed = forwardList.length;
      const totalLimit = userInfo.num || 0;
      // 无限制时返回0%
      if (userInfo.num === 99999) return 0;
      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    }
    return 0;
  };

  const formatResetTime = (resetDay?: number): string => {
    if (resetDay === undefined || resetDay === null) return "";
    if (resetDay === 0) return "不重置";

    const now = new Date();
    const currentDay = now.getDate();

    let daysUntilReset;
    if (resetDay > currentDay) {
      daysUntilReset = resetDay - currentDay;
    } else if (resetDay < currentDay) {
      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        resetDay,
      );
      const diffTime = nextMonth.getTime() - now.getTime();
      daysUntilReset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysUntilReset = 0;
    }

    if (daysUntilReset === 0) {
      return "今日重置";
    } else if (daysUntilReset === 1) {
      return "明日重置";
    } else {
      return `${daysUntilReset}天后重置`;
    }
  };

  const groupedForwards = () => {
    const groups: {
      [key: string]: { tunnelName: string; forwards: Forward[] };
    } = {};
    forwardList.forEach((forward) => {
      const tunnelName = forward.tunnelName || "未知隧道";
      if (!groups[tunnelName]) {
        groups[tunnelName] = {
          tunnelName,
          forwards: [],
        };
      }
      groups[tunnelName].forwards.push(forward);
    });
    return Object.values(groups);
  };

  const formatInAddress = (ipString: string, port: number): string => {
    if (!ipString || !port) return "";

    const ips = ipString
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip);

    if (ips.length === 0) return "";

    if (ips.length === 1) {
      const ip = ips[0];
      if (ip.includes(":") && !ip.startsWith("[")) {
        return `[${ip}]:${port}`;
      } else {
        return `${ip}:${port}`;
      }
    }

    const firstIp = ips[0];
    let formattedFirstIp;

    if (firstIp.includes(":") && !firstIp.startsWith("[")) {
      formattedFirstIp = `[${firstIp}]`;
    } else {
      formattedFirstIp = firstIp;
    }

    return `${formattedFirstIp}:${port} (+${ips.length - 1})`;
  };

  const formatRemoteAddress = (remoteAddr: string): string => {
    if (!remoteAddr) return "";

    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    if (addresses.length === 0) return "";

    if (addresses.length === 1) {
      return addresses[0];
    }

    return `${addresses[0]} (+${addresses.length - 1})`;
  };

  const showAddressModal = (ipString: string, port: number, title: string) => {
    if (!ipString || !port) return;

    const ips = ipString
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip);

    if (ips.length <= 1) {
      copyToClipboard(formatInAddress(ipString, port));
      return;
    }

    const formattedList = ips.map((ip, index) => {
      let formattedAddress;
      if (ip.includes(":") && !ip.startsWith("[")) {
        formattedAddress = `[${ip}]:${port}`;
      } else {
        formattedAddress = `${ip}:${port}`;
      }
      return {
        id: index,
        ip: ip,
        address: formattedAddress,
        copying: false,
      };
    });

    setAddressList(formattedList);
    setAddressModalTitle(`${title} (${ips.length}个)`);
    setAddressModalOpen(true);
  };

  const showRemoteAddressModal = (remoteAddr: string, title: string) => {
    if (!remoteAddr) return;

    const addresses = remoteAddr
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr);

    if (addresses.length <= 1) {
      copyToClipboard(remoteAddr);
      return;
    }

    const formattedList = addresses.map((address, index) => {
      return {
        id: index,
        ip: address,
        address: address,
        copying: false,
      };
    });

    setAddressList(formattedList);
    setAddressModalTitle(`${title} (${addresses.length}个)`);
    setAddressModalOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    if (await copyTextToClipboard(text)) {
      toast.success(`已复制`);
    } else {
      toast.error("复制失败,请手动选择文本复制");
    }
  };

  const copyAddress = async (addressItem: AddressItem) => {
    try {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: true } : item,
        ),
      );
      await copyToClipboard(addressItem.address);
    } catch (error) {
      toast.error("复制失败");
    } finally {
      setAddressList((prev) =>
        prev.map((item) =>
          item.id === addressItem.id ? { ...item, copying: false } : item,
        ),
      );
    }
  };

  const copyAllAddresses = async () => {
    if (addressList.length === 0) return;
    const allAddresses = addressList.map((item) => item.address).join("\n");
    await copyToClipboard(allAddresses);
  };

  const calculateForwardBillingFlow = (forward: Forward): number => {
    if (!forward) return 0;

    const inFlow = forward.inFlow || 0;
    const outFlow = forward.outFlow || 0;

    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return inFlow + outFlow;
  };

  const forwardGroups = groupedForwards();
  const usedFlow = calculateUserTotalUsedFlow();
  const flowUsage = calculateUsagePercentage("flow");
  const forwardUsage = calculateUsagePercentage("forwards");

  const toggleForwardGroup = (groupName: string) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupName]: !(previous[groupName] ?? true),
    }));
  };

  const isForwardGroupExpanded = (groupName: string) =>
    expandedGroups[groupName] ?? true;

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-loading">
          <span aria-hidden="true" className="loading-spinner" />
          正在加载…
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell dashboard-page text-foreground">
      <div className="mx-auto max-w-none">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              仪表板
            </h1>
            <p className="page-subtitle">
              账户用量、统计范围和转发线路一览
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-default-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            数据实时同步
          </div>
        </div>

        <div className="dashboard-compose">
        <section className="dashboard-metrics">
          <article className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-default-500">总流量</p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                  {formatFlow(userInfo.flow, "gb")}
                </p>
                <p className="mt-1 text-xs text-default-400">套餐上限</p>
              </div>
              <span className="dashboard-metric-icon bg-primary-50 text-primary">
                <ArrowsRightLeftIcon className="h-[18px] w-[18px]" />
              </span>
            </div>
          </article>

          <article className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-default-500">已用流量</p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                  {formatFlow(usedFlow)}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-default-200">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width:
                        userInfo.flow === 99999
                          ? "38%"
                          : String(Math.min(flowUsage, 100)) + "%",
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-default-400">
                  <span>
                    {userInfo.flow === 99999
                      ? "无限制"
                      : String(flowUsage.toFixed(1)) + "%"}
                  </span>
                  {userInfo.flowResetTime !== undefined &&
                    userInfo.flowResetTime !== null && (
                      <span className="truncate">
                        {formatResetTime(userInfo.flowResetTime)}
                      </span>
                    )}
                </div>
              </div>
              <span className="dashboard-metric-icon bg-success-50 text-success">
                <ChartBarIcon className="h-[18px] w-[18px]" />
              </span>
            </div>
          </article>

          {isAdmin && (
            <article className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-default-500">
                    转发配额
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                    {formatNumber(userInfo.num || 0)}
                  </p>
                  <p className="mt-1 text-xs text-default-400">
                    账户级线路数量
                  </p>
                </div>
                <span className="dashboard-metric-icon bg-primary-50 text-primary">
                  <QueueListIcon className="h-[18px] w-[18px]" />
                </span>
              </div>
            </article>
          )}

          {isAdmin && (
            <article className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-default-500">
                    已用转发
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                    {forwardList.length}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-default-200">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width:
                          userInfo.num === 99999
                            ? "42%"
                            : String(Math.min(forwardUsage, 100)) + "%",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-default-400">
                    {userInfo.num === 99999
                      ? "无限制"
                      : String(forwardUsage.toFixed(1)) + "%"}
                  </p>
                </div>
                <span className="dashboard-metric-icon bg-success-50 text-success">
                  <ArrowTrendingUpIcon className="h-[18px] w-[18px]" />
                </span>
              </div>
            </article>
          )}
        </section>

        <section className="overflow-hidden border-t border-zinc-200">
          <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  流量统计
                </h2>
                {flowStatisticsLoading && (
                  <span className="rounded-full bg-primary-50 px-2 py-1 text-[11px] font-medium text-primary">
                    查询中
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-default-500">
                {flowStatistics?.granularity === "day"
                  ? "多日按天汇总"
                  : "单日按小时展示"}{" "}
                · 当前范围 {statisticsRangeText} · 合计{" "}
                {formatFlow(flowStatistics?.totalFlow || 0)} · 下载{" "}
                {formatFlow(flowStatistics?.downloadFlow || 0)} · 上传{" "}
                {formatFlow(flowStatistics?.uploadFlow || 0)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                aria-label="统计快捷范围"
                className="flex items-center rounded-lg bg-default-100 p-1"
                role="group"
              >
                <Button
                  className={
                    activeShortcut === "today"
                      ? "h-8 min-w-0 rounded-md bg-content1 px-3 text-xs font-medium text-foreground shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-default-500"
                  }
                  isDisabled={flowStatisticsLoading}
                  size="sm"
                  variant="light"
                  onPress={() =>
                    applyStatisticsShortcut(createTodayRange(), "today")
                  }
                >
                  今天
                </Button>
                <Button
                  className={
                    activeShortcut === "7d"
                      ? "h-8 min-w-0 rounded-md bg-content1 px-3 text-xs font-medium text-foreground shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-default-500"
                  }
                  isDisabled={flowStatisticsLoading}
                  size="sm"
                  variant="light"
                  onPress={() =>
                    applyStatisticsShortcut(createLastDaysRange(7), "7d")
                  }
                >
                  近7天
                </Button>
                <Button
                  className={
                    activeShortcut === "30d"
                      ? "h-8 min-w-0 rounded-md bg-content1 px-3 text-xs font-medium text-foreground shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-default-500"
                  }
                  isDisabled={flowStatisticsLoading}
                  size="sm"
                  variant="light"
                  onPress={() =>
                    applyStatisticsShortcut(createLastDaysRange(30), "30d")
                  }
                >
                  近30天
                </Button>
              </div>

              <label className="dashboard-date-field">
                <span>开始日期</span>
                <input
                  aria-label="开始日期"
                  type="date"
                  value={statisticsRange.startDate}
                  onChange={(event) => {
                    setActiveShortcut("custom");
                    setStatisticsRange((previous) => ({
                      ...previous,
                      startDate: event.target.value,
                    }));
                  }}
                />
              </label>
              <label className="dashboard-date-field">
                <span>结束日期</span>
                <input
                  aria-label="结束日期"
                  type="date"
                  value={statisticsRange.endDate}
                  onChange={(event) => {
                    setActiveShortcut("custom");
                    setStatisticsRange((previous) => ({
                      ...previous,
                      endDate: event.target.value,
                    }));
                  }}
                />
              </label>
              <Button
                className="h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-none"
                isDisabled={flowStatisticsLoading}
                size="sm"
                startContent={<SearchIcon size={15} />}
                onPress={handleStatisticsQuery}
              >
                {flowStatisticsLoading ? "查询中" : "查询"}
              </Button>
            </div>
          </div>

          <div className="px-4 pb-5 pt-4 sm:px-5">
            {flowStatisticsLoading && !flowStatistics ? (
              <div className="flex h-[223px] items-center justify-center text-sm text-default-400">
                正在加载流量统计...
              </div>
            ) : (flowStatistics?.points?.length || 0) === 0 ? (
              <div className="flex h-[223px] flex-col items-center justify-center text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-default-100 text-default-400">
                  <SearchIcon size={18} />
                </span>
                <p className="text-sm font-medium text-default-600">
                  暂无流量统计数据
                </p>
                <p className="mt-1 text-xs text-default-400">
                  调整日期范围后重新查询
                </p>
              </div>
            ) : (
              <div
                className={
                  flowStatisticsLoading
                    ? "h-[223px] w-full opacity-60"
                    : "h-[223px] w-full"
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processFlowChartData()}
                    margin={{ top: 12, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--heroui-default-200))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={{ stroke: "hsl(var(--heroui-default-300))" }}
                      dataKey="time"
                      tick={{
                        fill: "hsl(var(--heroui-default-500))",
                        fontSize: 11,
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fill: "hsl(var(--heroui-default-500))",
                        fontSize: 11,
                      }}
                      tickFormatter={(value) => {
                        if (value === 0) return "0";
                        if (value < 1024) return String(value) + "B";
                        if (value < 1024 * 1024)
                          return String((value / 1024).toFixed(1)) + "K";
                        if (value < 1024 * 1024 * 1024)
                          return (
                            String((value / (1024 * 1024)).toFixed(1)) + "M"
                          );

                        return (
                          String((value / (1024 * 1024 * 1024)).toFixed(1)) +
                          "G"
                        );
                      }}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) {
                          return null;
                        }

                        return (
                          <div className="space-y-1 rounded-lg border border-divider bg-content1 p-3 shadow-lg">
                            <p className="text-xs font-semibold text-foreground">
                              {(flowStatistics?.granularity === "day"
                                ? "日期"
                                : "时间") +
                                ": " +
                                String(label)}
                            </p>
                            {payload.map((item) => (
                              <p
                                key={item.dataKey?.toString()}
                                className="text-xs"
                                style={{ color: item.color }}
                              >
                                {String(item.name || item.dataKey) +
                                  ": " +
                                  formatFlow((item.value as number) || 0)}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{
                        color: "hsl(var(--heroui-default-500))",
                        fontSize: 12,
                        paddingTop: 12,
                      }}
                    />
                    <Line
                      activeDot={{
                        fill: "hsl(var(--heroui-content1))",
                        r: 4,
                        stroke: "hsl(var(--heroui-success))",
                        strokeWidth: 2,
                      }}
                      dataKey="uploadFlow"
                      name="上传"
                      dot={{ r: 1.5, strokeWidth: 0 }}
                      stroke="hsl(var(--heroui-success))"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      activeDot={{
                        fill: "hsl(var(--heroui-content1))",
                        r: 4,
                        stroke: "hsl(var(--heroui-warning))",
                        strokeWidth: 2,
                      }}
                      dataKey="downloadFlow"
                      name="下载"
                      dot={{ r: 1.5, strokeWidth: 0 }}
                      stroke="hsl(var(--heroui-warning))"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      activeDot={{
                        fill: "hsl(var(--heroui-content1))",
                        r: 4,
                        stroke: "hsl(var(--heroui-primary))",
                        strokeWidth: 2,
                      }}
                      dataKey="flow"
                      name="总量"
                      dot={{ r: 1.5, strokeWidth: 0 }}
                      stroke="hsl(var(--heroui-primary))"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        </div>

        {isAdmin && (
          <section className="dashboard-surface mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    转发配置
                  </h2>
                  <span className="rounded-full bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary">
                    {forwardList.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-default-400">
                  按节点分组查看当前转发线路与用量
                </p>
              </div>
              <span className="hidden items-center gap-2 text-xs text-default-400 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                线路状态正常
              </span>
            </div>

            {forwardGroups.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-default-100 text-default-400">
                  <PlusIcon size={18} />
                </span>
                <p className="text-sm font-medium text-default-600">
                  暂无转发配置
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(180px,1.15fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(100px,.65fr)_minmax(100px,.65fr)_minmax(100px,.65fr)] gap-4 border-b border-divider bg-default-50 px-5 py-3 text-[11px] font-semibold text-default-500">
                    <span>转发名称</span>
                    <span>入口地址（监听）</span>
                    <span>目标地址（转发至）</span>
                    <span>上传</span>
                    <span>下载</span>
                    <span>计费</span>
                  </div>

                  {forwardGroups.map((group) => {
                    const expanded = isForwardGroupExpanded(group.tunnelName);
                    const healthy = group.forwards.every(
                      (forward) => forward.serviceRunning !== false,
                    );

                    return (
                      <div key={group.tunnelName}>
                        <button
                          aria-expanded={expanded}
                          className="flex w-full items-center justify-between border-b border-divider px-5 py-3 text-left transition-colors hover:bg-default-50"
                          type="button"
                          onClick={() => toggleForwardGroup(group.tunnelName)}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={
                                expanded
                                  ? "text-primary transition-transform"
                                  : "text-default-400 transition-transform"
                              }
                            >
                              <PlusIcon
                                className={expanded ? "rotate-45" : ""}
                                size={15}
                              />
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {group.tunnelName}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-default-400">
                              <span
                                className={
                                  healthy
                                    ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                                    : "h-1.5 w-1.5 rounded-full bg-amber-500"
                                }
                              />
                              {healthy ? "运行中" : "需要关注"}
                            </span>
                          </span>
                          <span className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
                            {isProtocolDesignPreview
                              ? 8
                              : group.forwards.length}
                            个转发
                          </span>
                        </button>

                        {expanded &&
                          group.forwards.map((forward) => (
                            <div
                              key={forward.id}
                              className="grid grid-cols-[minmax(180px,1.15fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(100px,.65fr)_minmax(100px,.65fr)_minmax(100px,.65fr)] gap-4 border-b border-divider px-5 py-3.5 transition-colors hover:bg-default-50"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <span className="truncate text-sm font-medium text-foreground">
                                  {forward.name}
                                </span>
                              </div>
                              <button
                                className="min-w-0 truncate text-left font-mono text-xs text-success transition-colors hover:text-success-600"
                                title={formatInAddress(
                                  forward.inIp,
                                  forward.inPort,
                                )}
                                type="button"
                                onClick={() =>
                                  showAddressModal(
                                    forward.inIp,
                                    forward.inPort,
                                    "入口地址",
                                  )
                                }
                              >
                                {formatInAddress(forward.inIp, forward.inPort)}
                              </button>
                              <button
                                className="min-w-0 truncate text-left font-mono text-xs text-primary transition-colors hover:text-primary-600"
                                title={formatRemoteAddress(forward.remoteAddr)}
                                type="button"
                                onClick={() =>
                                  showRemoteAddressModal(
                                    forward.remoteAddr,
                                    "出口地址",
                                  )
                                }
                              >
                                {formatRemoteAddress(forward.remoteAddr)}
                              </button>
                              <span className="font-mono text-xs font-medium text-success">
                                {formatFlow(forward.inFlow || 0)}
                              </span>
                              <span className="font-mono text-xs font-medium text-warning">
                                {formatFlow(forward.outFlow || 0)}
                              </span>
                              <span className="font-mono text-xs font-medium text-primary">
                                {formatFlow(
                                  calculateForwardBillingFlow(forward),
                                )}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <Modal
          backdrop="opaque"
          isOpen={addressModalOpen}
          placement="center"
          scrollBehavior="outside"
          size="2xl"
          onClose={() => setAddressModalOpen(false)}
        >
          <ModalContent>
            <ModalHeader className="text-base">{addressModalTitle}</ModalHeader>
            <ModalBody className="pb-6">
              <div className="mb-4 text-right">
                <Button size="sm" onClick={copyAllAddresses}>
                  复制全部
                </Button>
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {addressList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                  >
                    <code className="mr-3 flex-1 text-sm text-foreground">
                      {item.address}
                    </code>
                    <Button
                      isLoading={item.copying}
                      size="sm"
                      variant="light"
                      onClick={() => copyAddress(item)}
                    >
                      复制
                    </Button>
                  </div>
                ))}
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
