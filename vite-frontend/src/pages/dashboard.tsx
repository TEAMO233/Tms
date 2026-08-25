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
import { getFlowStatisticsRange, getUserPackageInfo } from "@/api";
import type { FlowStatisticsResponse } from "@/types";
import {
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo>({} as UserInfo);
  const [forwardList, setForwardList] = useState<Forward[]>([]);
  const [statisticsRange, setStatisticsRange] = useState<FlowStatisticsDateRange>(() => createTodayRange());
  const [appliedStatisticsRange, setAppliedStatisticsRange] = useState<FlowStatisticsDateRange>(() => createTodayRange());
  const [flowStatistics, setFlowStatistics] = useState<FlowStatisticsResponse | null>(null);
  const [flowStatisticsLoading, setFlowStatisticsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState<"today" | "7d" | "30d" | "custom">(
    "today",
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressModalTitle, setAddressModalTitle] = useState('');
  const [addressList, setAddressList] = useState<AddressItem[]>([]);

  // 检查有效期通知
  const checkExpirationNotifications = (userInfo: UserInfo, tunnels: UserTunnel[]) => {
    // 避免重复通知，检查是否已经显示过
    const notificationKey = `expiration-${userInfo.expTime}-${tunnels.map(t => t.expTime).join(',')}`;
    const lastNotified = localStorage.getItem('lastNotified');

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
            toast('账户将于明天过期，请及时续费', {
              icon: '⚠️',
              duration: 6000,
              style: { background: '#f59e0b', color: '#fff' }
            });
          } else {
            toast(`账户将于${diffDays}天后过期，请及时续费`, {
              icon: '⚠️',
              duration: 6000,
              style: { background: '#f59e0b', color: '#fff' }
            });
          }
        } else if (diffDays <= 0) {
          hasNotification = true;
          toast('账户已过期，请立即续费', {
            icon: '⚠️',
            duration: 8000,
            style: { background: '#ef4444', color: '#fff' }
          });
        }
      }
    }

    // 检查隧道有效期
    tunnels.forEach(tunnel => {
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
                icon: '⚠️',
                duration: 5000,
                style: { background: '#f59e0b', color: '#fff' }
              });
            } else {
              toast(`隧道"${tunnel.tunnelName}"将于${diffDays}天后过期`, {
                icon: '⚠️',
                duration: 5000,
                style: { background: '#f59e0b', color: '#fff' }
              });
            }
          } else if (diffDays <= 0) {
            hasNotification = true;
            toast(`隧道"${tunnel.tunnelName}"已过期`, {
              icon: '⚠️',
              duration: 6000,
              style: { background: '#ef4444', color: '#fff' }
            });
          }
        }
      }
    });

    // 如果显示了通知，记录防止重复
    if (hasNotification) {
      localStorage.setItem('lastNotified', notificationKey);
    }
  };

  useEffect(() => {
    // 重置状态并加载数据，防止页面切换时显示旧数据
    setLoading(true);
    setUserInfo({} as UserInfo);
    setForwardList([]);
    setFlowStatistics(null);

    // 检查用户是否是管理员
    const adminStatus = localStorage.getItem('admin');
    setIsAdmin(adminStatus === 'true');

    const today = createTodayRange();
    setStatisticsRange(today);
    setAppliedStatisticsRange(today);
    setActiveShortcut("today");
    loadPackageData();
    loadFlowStatistics(today);
    localStorage.setItem('e', '/dashboard');
  }, []);

  const loadPackageData = async () => {
    setLoading(true);
    try {
      const res = await getUserPackageInfo();
      if (res.code === 0) {
        const data = res.data;
        setUserInfo(data.userInfo || {});
        setForwardList(data.forwards || []);

        // 检查有效期并显示通知
        checkExpirationNotifications(data.userInfo, data.tunnelPermissions || []);
      } else {
        toast.error(res.msg || '获取套餐信息失败');
      }
    } catch (error) {
      console.error('获取套餐信息失败:', error);
      toast.error('获取套餐信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadFlowStatistics = async (range: FlowStatisticsDateRange = statisticsRange) => {
    setFlowStatisticsLoading(true);
    try {
      const query = buildFlowStatisticsRange(range.startDate, range.endDate);
      const res = await getFlowStatisticsRange(query);
      if (res.code === 0) {
        setFlowStatistics(res.data || null);
        setAppliedStatisticsRange(range);
      } else {
        toast.error(res.msg || '获取流量统计失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取流量统计失败');
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

  const formatFlow = (value: number, unit: string = 'bytes'): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return '无限制';
    }

    if (unit === 'gb') {
      return value + ' GB';
    } else {
      if (value === 0) return '0 B';
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(2) + ' KB';
      if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(2) + ' MB';
      return (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  };

  const formatNumber = (value: number): string => {
    // 99999 表示无限制
    if (value === 99999) {
      return '无限制';
    }
    return value.toString();
  };

  // 处理流量统计数据：当天按小时,跨天按自然日,并拆分上传/下载
  const processFlowChartData = () => toFlowChartData(flowStatistics?.points || []);

  const statisticsRangeText = `${appliedStatisticsRange.startDate} 至 ${appliedStatisticsRange.endDate}`;

  const calculateUserTotalUsedFlow = (): number => {
    // 后端已按计费类型处理流量，前端直接使用入站+出站总和
    return (userInfo.inFlow || 0) + (userInfo.outFlow || 0);
  };

  const calculateUsagePercentage = (type: 'flow' | 'forwards'): number => {
    if (type === 'flow') {
      const totalUsed = calculateUserTotalUsedFlow();
      const totalLimit = (userInfo.flow || 0) * 1024 * 1024 * 1024;
      // 无限制时返回0%
      if (userInfo.flow === 99999) return 0;
      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    } else if (type === 'forwards') {
      const totalUsed = forwardList.length;
      const totalLimit = userInfo.num || 0;
      // 无限制时返回0%
      if (userInfo.num === 99999) return 0;
      return totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
    }
    return 0;
  };

  const formatResetTime = (resetDay?: number): string => {
    if (resetDay === undefined || resetDay === null) return '';
    if (resetDay === 0) return '不重置';

    const now = new Date();
    const currentDay = now.getDate();

    let daysUntilReset;
    if (resetDay > currentDay) {
      daysUntilReset = resetDay - currentDay;
    } else if (resetDay < currentDay) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, resetDay);
      const diffTime = nextMonth.getTime() - now.getTime();
      daysUntilReset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      daysUntilReset = 0;
    }

    if (daysUntilReset === 0) {
      return '今日重置';
    } else if (daysUntilReset === 1) {
      return '明日重置';
    } else {
      return `${daysUntilReset}天后重置`;
    }
  };

  const groupedForwards = () => {
    const groups: { [key: string]: { tunnelName: string; forwards: Forward[] } } = {};
    forwardList.forEach(forward => {
      const tunnelName = forward.tunnelName || '未知隧道';
      if (!groups[tunnelName]) {
        groups[tunnelName] = {
          tunnelName,
          forwards: []
        };
      }
      groups[tunnelName].forwards.push(forward);
    });
    return Object.values(groups);
  };

  const formatInAddress = (ipString: string, port: number): string => {
    if (!ipString || !port) return '';

    const ips = ipString.split(',').map(ip => ip.trim()).filter(ip => ip);

    if (ips.length === 0) return '';

    if (ips.length === 1) {
      const ip = ips[0];
      if (ip.includes(':') && !ip.startsWith('[')) {
        return `[${ip}]:${port}`;
      } else {
        return `${ip}:${port}`;
      }
    }

    const firstIp = ips[0];
    let formattedFirstIp;

    if (firstIp.includes(':') && !firstIp.startsWith('[')) {
      formattedFirstIp = `[${firstIp}]`;
    } else {
      formattedFirstIp = firstIp;
    }

    return `${formattedFirstIp}:${port} (+${ips.length - 1})`;
  };

  const formatRemoteAddress = (remoteAddr: string): string => {
    if (!remoteAddr) return '';

    const addresses = remoteAddr.split(',').map(addr => addr.trim()).filter(addr => addr);

    if (addresses.length === 0) return '';

    if (addresses.length === 1) {
      return addresses[0];
    }

    return `${addresses[0]} (+${addresses.length - 1})`;
  };

  const showAddressModal = (ipString: string, port: number, title: string) => {
    if (!ipString || !port) return;

    const ips = ipString.split(',').map(ip => ip.trim()).filter(ip => ip);

    if (ips.length <= 1) {
              copyToClipboard(formatInAddress(ipString, port));
      return;
    }

    const formattedList = ips.map((ip, index) => {
      let formattedAddress;
      if (ip.includes(':') && !ip.startsWith('[')) {
        formattedAddress = `[${ip}]:${port}`;
      } else {
        formattedAddress = `${ip}:${port}`;
      }
      return {
        id: index,
        ip: ip,
        address: formattedAddress,
        copying: false
      };
    });

    setAddressList(formattedList);
    setAddressModalTitle(`${title} (${ips.length}个)`);
    setAddressModalOpen(true);
  };

  const showRemoteAddressModal = (remoteAddr: string, title: string) => {
    if (!remoteAddr) return;

    const addresses = remoteAddr.split(',').map(addr => addr.trim()).filter(addr => addr);

    if (addresses.length <= 1) {
              copyToClipboard(remoteAddr);
      return;
    }

    const formattedList = addresses.map((address, index) => {
      return {
        id: index,
        ip: address,
        address: address,
        copying: false
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
      toast.error('复制失败,请手动选择文本复制');
    }
  };

  const copyAddress = async (addressItem: AddressItem) => {
    try {
      setAddressList(prev => prev.map(item =>
        item.id === addressItem.id ? { ...item, copying: true } : item
      ));
      await copyToClipboard(addressItem.address);
    } catch (error) {
      toast.error('复制失败');
    } finally {
      setAddressList(prev => prev.map(item =>
        item.id === addressItem.id ? { ...item, copying: false } : item
      ));
    }
  };

  const copyAllAddresses = async () => {
    if (addressList.length === 0) return;
    const allAddresses = addressList.map(item => item.address).join('\n');
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
      <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[420px] max-w-[1440px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#1465f5]" />
            正在加载数据...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page min-h-full px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1465f5]">
              TRAFFIC CONTROL
            </p>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950">
              仪表板
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              账户用量、统计范围和转发线路一览
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            数据实时同步
          </div>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="dashboard-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">总流量</p>
                <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-slate-950">
                  {formatFlow(userInfo.flow, "gb")}
                </p>
                <p className="mt-2 text-xs text-slate-400">套餐上限</p>
              </div>
              <span className="dashboard-metric-icon bg-[#edf4ff] text-[#4a82ee]">
                <SettingsIcon size={17} />
              </span>
            </div>
          </article>

          <article className="dashboard-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-500">已用流量</p>
                <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-slate-950">
                  {formatFlow(usedFlow)}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf0f5]">
                  <div
                    className="h-full rounded-full bg-[#2e73ed] transition-all duration-500"
                    style={{
                      width:
                        userInfo.flow === 99999
                          ? "38%"
                          : String(Math.min(flowUsage, 100)) + "%",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
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
              <span className="dashboard-metric-icon bg-[#edf8f2] text-[#18a05d]">
                <SearchIcon size={17} />
              </span>
            </div>
          </article>

          {isAdmin && (
            <article className="dashboard-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">转发配额</p>
                  <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-slate-950">
                    {formatNumber(userInfo.num || 0)}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">账户级线路数量</p>
                </div>
                <span className="dashboard-metric-icon bg-[#f3efff] text-[#7546e9]">
                  <PlusIcon size={17} />
                </span>
              </div>
            </article>
          )}

          {isAdmin && (
            <article className="dashboard-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-500">已用转发</p>
                  <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-slate-950">
                    {forwardList.length}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf0f5]">
                    <div
                      className="h-full rounded-full bg-[#176cf1] transition-all duration-500"
                      style={{
                        width:
                          userInfo.num === 99999
                            ? "42%"
                            : String(Math.min(forwardUsage, 100)) + "%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {userInfo.num === 99999
                      ? "无限制"
                      : String(forwardUsage.toFixed(1)) + "%"}
                  </p>
                </div>
                <span className="dashboard-metric-icon bg-[#eef5ff] text-[#3c7eef]">
                  <UserIcon size={17} />
                </span>
              </div>
            </article>
          )}
        </section>

        <section className="dashboard-surface mt-4 overflow-hidden">
          <div className="flex flex-col gap-5 border-b border-[#e8ebf0] p-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  流量统计
                </h2>
                {flowStatisticsLoading && (
                  <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-[11px] font-medium text-[#1465f5]">
                    查询中
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
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
                className="flex items-center rounded-lg bg-[#f4f6f9] p-1"
                role="group"
              >
                <Button
                  className={
                    activeShortcut === "today"
                      ? "h-8 min-w-0 rounded-md bg-white px-3 text-xs font-medium text-slate-900 shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-slate-500"
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
                      ? "h-8 min-w-0 rounded-md bg-white px-3 text-xs font-medium text-slate-900 shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-slate-500"
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
                      ? "h-8 min-w-0 rounded-md bg-white px-3 text-xs font-medium text-slate-900 shadow-sm"
                      : "h-8 min-w-0 rounded-md px-3 text-xs font-medium text-slate-500"
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
                className="h-10 rounded-lg bg-[#1465f5] px-4 text-xs font-semibold text-white shadow-none"
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
              <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
                正在加载流量统计...
              </div>
            ) : (flowStatistics?.points?.length || 0) === 0 ? (
              <div className="flex h-[320px] flex-col items-center justify-center text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f8] text-[#91a0b4]">
                  <SearchIcon size={18} />
                </span>
                <p className="text-sm font-medium text-slate-600">
                  暂无流量统计数据
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  调整日期范围后重新查询
                </p>
              </div>
            ) : (
              <div
                className={
                  flowStatisticsLoading
                    ? "h-[320px] w-full opacity-60"
                    : "h-[320px] w-full"
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processFlowChartData()}
                    margin={{ top: 12, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#e9edf3"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={{ stroke: "#dfe4eb" }}
                      dataKey="time"
                      tick={{ fill: "#8b96a6", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: "#8b96a6", fontSize: 11 }}
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
                          String(
                            (value / (1024 * 1024 * 1024)).toFixed(1),
                          ) + "G"
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
                          <div className="space-y-1 rounded-lg border border-[#e3e7ee] bg-white p-3 shadow-lg">
                            <p className="text-xs font-semibold text-slate-800">
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
                        color: "#64748b",
                        fontSize: 12,
                        paddingTop: 12,
                      }}
                    />
                    <Line
                      activeDot={{
                        fill: "#ffffff",
                        r: 4,
                        stroke: "#16a05d",
                        strokeWidth: 2,
                      }}
                      dataKey="uploadFlow"
                      name="上传"
                      dot={false}
                      stroke="#16a05d"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      activeDot={{
                        fill: "#ffffff",
                        r: 4,
                        stroke: "#f28a13",
                        strokeWidth: 2,
                      }}
                      dataKey="downloadFlow"
                      name="下载"
                      dot={false}
                      stroke="#f28a13"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                    <Line
                      activeDot={{
                        fill: "#ffffff",
                        r: 4,
                        stroke: "#7440e8",
                        strokeWidth: 2,
                      }}
                      dataKey="flow"
                      name="总量"
                      dot={false}
                      stroke="#7440e8"
                      strokeDasharray="5 5"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {isAdmin && (
          <section className="dashboard-surface mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#e8ebf0] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                    转发配置
                  </h2>
                  <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-[11px] font-semibold text-[#1465f5]">
                    {forwardList.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  按节点分组查看当前转发线路与用量
                </p>
              </div>
              <span className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                线路状态正常
              </span>
            </div>

            {forwardGroups.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f8] text-[#91a0b4]">
                  <PlusIcon size={18} />
                </span>
                <p className="text-sm font-medium text-slate-600">
                  暂无转发配置
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(180px,1.15fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(100px,.65fr)_minmax(100px,.65fr)_minmax(100px,.65fr)] gap-4 border-b border-[#eef1f4] bg-[#fafbfc] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                          className="flex w-full items-center justify-between border-b border-[#eef1f4] px-5 py-3 text-left transition-colors hover:bg-[#f8fafc]"
                          type="button"
                          onClick={() => toggleForwardGroup(group.tunnelName)}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={
                                expanded
                                  ? "text-[#1465f5] transition-transform"
                                  : "text-slate-400 transition-transform"
                              }
                            >
                              <PlusIcon
                                className={expanded ? "rotate-45" : ""}
                                size={15}
                              />
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {group.tunnelName}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-slate-400">
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
                          <span className="rounded-md bg-[#1465f5] px-2.5 py-1.5 text-xs font-semibold text-white">
                            {group.forwards.length}个转发
                          </span>
                        </button>

                        {expanded &&
                          group.forwards.map((forward) => (
                            <div
                              key={forward.id}
                              className="grid grid-cols-[minmax(180px,1.15fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(100px,.65fr)_minmax(100px,.65fr)_minmax(100px,.65fr)] gap-4 border-b border-[#f0f2f5] px-5 py-3.5 transition-colors hover:bg-[#fbfcfe]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <span className="truncate text-sm font-medium text-slate-700">
                                  {forward.name}
                                </span>
                              </div>
                              <button
                                className="min-w-0 truncate text-left font-mono text-xs text-emerald-600 transition-colors hover:text-emerald-700"
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
                                className="min-w-0 truncate text-left font-mono text-xs text-blue-600 transition-colors hover:text-blue-700"
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
                              <span className="font-mono text-xs font-medium text-emerald-600">
                                {formatFlow(forward.inFlow || 0)}
                              </span>
                              <span className="font-mono text-xs font-medium text-orange-500">
                                {formatFlow(forward.outFlow || 0)}
                              </span>
                              <span className="font-mono text-xs font-medium text-[#1465f5]">
                                {formatFlow(calculateForwardBillingFlow(forward))}
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
          backdrop="blur"
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
                    className="flex items-center justify-between rounded-lg border border-default-200 p-3 dark:border-default-100"
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
