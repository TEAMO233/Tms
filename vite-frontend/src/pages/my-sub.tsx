import type { User } from "@/types";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import toast from "react-hot-toast";

import { getMyLines, getUserPackageInfo } from "@/api";
import { SubQrToggle } from "@/components/sub-qr";
import { copyTextToClipboard } from "@/utils/clipboard";

type LineFilter = "all" | "direct" | "relay";

interface MyLine {
  nodeId?: number;
  nodeName?: string;
  type?: string;
  landingName?: string | null;
  flow?: number | string | null;
  quotaGb?: number | string | null;
  lineExpTime?: number | null;
  lineStatus?: number | null;
  protocolCount?: number | null;
  subToken?: string | null;
}

interface MyLinesPayload {
  lines?: MyLine[];
  allSubToken?: string | null;
}

type AccountInfo = Partial<Pick<User, "status" | "expTime">>;

interface PackagePayload {
  userInfo?: AccountInfo | null;
}

const GB = 1024 * 1024 * 1024;

const LINE_GRID_CLASS =
  "xl:grid-cols-[minmax(220px,1.55fr)_minmax(72px,.5fr)_minmax(176px,1.15fr)_minmax(112px,.75fr)_minmax(100px,.75fr)_minmax(156px,auto)]";

const toSafeNumber = (value: number | string | null | undefined): number => {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
};

const fmtGB = (bytes: number): string =>
  `${(Math.max(0, bytes) / GB).toFixed(2)} GB`;

const fmtDate = (ms: number): string => new Date(ms).toLocaleDateString();

/**
 * 我的订阅(车友视角)· 一条订阅 = 一个套餐。
 * 每条线路各自带流量配额、到期、状态——不存在"账号总流量"这种混淆概念。
 * 车友只管复制链接导客户端,内部的机器/端口/转发对他隐藏。
 */
export default function MySubPage() {
  const [lines, setLines] = useState<MyLine[]>([]);
  // 「全部线路」聚合订阅:一条链接包含他所有线路,以后新开线路也不用重发
  const [allSubToken, setAllSubToken] = useState("");
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [expandedLineKey, setExpandedLineKey] = useState<string | null>(null);

  const subUrl = (token: string): string =>
    `${window.location.origin}/api/v1/open_api/sub?token=${token}`;

  const copySubscription = async (url: string, successMessage: string) => {
    if (!url) {
      toast.error("暂无可用订阅地址");

      return;
    }

    const copied = await copyTextToClipboard(url);

    if (copied) {
      toast.success(successMessage);
    } else {
      toast.error("复制失败,点框内已全选,按 Ctrl+C");
    }
  };

  const load = async () => {
    try {
      const [ln, pkg] = await Promise.all([getMyLines(), getUserPackageInfo()]);

      if (ln.code === 0) {
        // 后端返回结构从数组改成了 {lines, allSubToken},这里两种都认,
        // 万一前后端镜像版本不同步也不会白屏
        const payload = ln.data as MyLine[] | MyLinesPayload | null;
        const nextLines = Array.isArray(payload)
          ? payload
          : payload?.lines || [];

        setLines(nextLines);
        setAllSubToken(
          Array.isArray(payload) ? "" : payload?.allSubToken || "",
        );
      }

      if (pkg.code === 0) {
        const payload = pkg.data as PackagePayload | null | undefined;

        setAccount(payload?.userInfo || null);
      }
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 账号级异常(被管理员停用 / 账号到期)才提示,平时不打扰
  // 必须转成真正的布尔值:exp_time = 0 表示「永久」,而 `0 && ...` 返回的是 0 不是 false,
  // React 会把这个 0 原样渲染到页面上(标题下面凭空多出一个 "0")
  const accountDisabled =
    !!account && account.status !== undefined && account.status !== 1;
  const accountExpired =
    !!account?.expTime && account.expTime > 0 && account.expTime <= Date.now();

  const directCount = lines.filter((line) => line.type !== "relay").length;
  const relayCount = lines.filter((line) => line.type === "relay").length;
  const protocolTotal = lines.reduce(
    (total, line) => total + toSafeNumber(line.protocolCount),
    0,
  );
  const visibleLines = lines.filter((line) => {
    if (lineFilter === "relay") return line.type === "relay";
    if (lineFilter === "direct") return line.type !== "relay";

    return true;
  });
  const filters: Array<{ key: LineFilter; label: string; count: number }> = [
    { key: "all", label: "全部", count: lines.length },
    { key: "direct", label: "直连", count: directCount },
    { key: "relay", label: "中转", count: relayCount },
  ];
  const hasAggregateSubscription =
    !loading && Boolean(allSubToken) && lines.length > 1;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 p-4 sm:gap-5 sm:p-6 lg:gap-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              我的订阅
            </h1>
            <span className="text-sm text-default-500">
              共 {lines.length} 条线路
            </span>
          </div>
          <p className="mt-1 text-sm text-default-500">
            每条线路独立计算流量与到期时间,按需选择直连或中转出口。
          </p>
        </div>
        {!loading && lines.length > 0 && (
          <div className="rounded-full border border-default-200/70 bg-default-50/40 px-3 py-1.5 text-xs text-default-500 dark:bg-white/5">
            共 {protocolTotal} 个协议可用
          </div>
        )}
      </div>

      {(accountDisabled || accountExpired) && (
        <Card className="border border-danger/40 bg-danger/5">
          <CardBody className="flex-row items-center gap-2 p-3 text-sm text-danger sm:p-4">
            <span aria-hidden="true">⚠️</span>
            <span>
              你的账号{accountExpired ? "已到期" : "已被停用"}
              ,所有线路暂时不可用,请联系管理员。
            </span>
          </CardBody>
        </Card>
      )}

      {hasAggregateSubscription && (
        <Card className="overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 shadow-lg shadow-primary/5">
          <CardBody className="gap-4 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip color="primary" size="sm" variant="solid">
                    ⭐ 推荐
                  </Chip>
                  <h2 className="text-lg font-semibold sm:text-xl">全部线路</h2>
                  <span className="text-sm text-default-500">
                    一条链接包含下面所有线路,推荐用于大多数设备或客户端。
                  </span>
                </div>
                <p className="mt-2 text-xs text-default-500">
                  更新一次订阅即可同步新增线路,不需要重新索要链接。
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-black/10 px-4 py-2.5 dark:bg-white/5">
                <div className="text-right">
                  <div className="text-xs text-default-500">协议数量</div>
                  <div className="text-xl font-bold leading-tight text-primary-600 dark:text-primary-300">
                    {protocolTotal}
                  </div>
                </div>
                <span aria-hidden="true" className="text-xl text-primary/60">
                  ▱
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start">
              <Input
                readOnly
                className="min-w-0 flex-1"
                size="sm"
                value={subUrl(allSubToken)}
                onClick={(event) => event.currentTarget.select()}
              />
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  color="primary"
                  size="sm"
                  onPress={() =>
                    copySubscription(subUrl(allSubToken), "已复制,去客户端粘贴")
                  }
                >
                  复制订阅链接
                </Button>
                <SubQrToggle url={subUrl(allSubToken)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-default-500">
              <span>节点名会带线路标识,方便区分出口。</span>
              <span>线路到期或用尽配额后会从聚合订阅中自动消失。</span>
            </div>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardBody className="py-12 text-center text-default-400">
            加载中...
          </CardBody>
        </Card>
      ) : lines.length === 0 ? (
        <Card>
          <CardBody className="space-y-2 py-12 text-center text-default-400">
            <div className="text-base text-default-600">还没有线路</div>
            <div className="mx-auto max-w-xl text-sm">
              管理员在「协议管理」或「中转」的机器卡上点「分配用户」给你开通;
              如果你就是管理员、想自己用,点那张卡上的「🔑 我自己用」即可。
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              aria-label="线路筛选"
              className="flex flex-wrap gap-2"
              role="tablist"
            >
              {filters.map((filter) => {
                const active = lineFilter === filter.key;

                return (
                  <Button
                    key={filter.key}
                    color={active ? "primary" : "default"}
                    size="sm"
                    variant={active ? "solid" : "flat"}
                    onPress={() => setLineFilter(filter.key)}
                  >
                    {filter.label} ({filter.count})
                  </Button>
                );
              })}
            </div>
            <span className="text-xs text-default-500">
              当前显示 {visibleLines.length} / {lines.length} 条线路
            </span>
          </div>

          <Card className="overflow-hidden border border-default-200/70 bg-black/10 dark:bg-white/[0.03]">
            <CardBody className="p-0">
              <div
                className={`hidden gap-4 border-b border-default-200/70 bg-default-50/50 px-4 py-3 text-xs font-medium text-default-500 dark:bg-white/[0.03] xl:grid ${LINE_GRID_CLASS}`}
              >
                <div>线路信息</div>
                <div>协议数量</div>
                <div>流量使用</div>
                <div>到期时间</div>
                <div>状态</div>
                <div className="text-right">操作</div>
              </div>

              {visibleLines.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-default-500">
                  当前筛选下没有线路,请切换其他分类。
                </div>
              ) : (
                visibleLines.map((line, index) => {
                  const isRelay = line.type === "relay";
                  const stopped = line.lineStatus === 0;
                  const used = Math.max(0, toSafeNumber(line.flow));
                  const quotaGb = Math.max(0, toSafeNumber(line.quotaGb));
                  const quotaBytes = quotaGb * GB;
                  const percentage =
                    quotaBytes > 0
                      ? Math.min(100, (used / quotaBytes) * 100)
                      : 0;
                  const token = line.subToken || "";
                  const url = token ? subUrl(token) : "";
                  const protocolCount = toSafeNumber(line.protocolCount);
                  const nodeName = line.nodeName || "未命名线路";
                  const lineLabel = isRelay
                    ? `中转${line.landingName ? `→${line.landingName}` : ""}`
                    : "直连";
                  const lineDescription = isRelay
                    ? `${line.landingName || "指定落地出口"} · 通过中转访问`
                    : "适用于本地网络或直连客户端";
                  const lineKey = `${line.nodeId || "line"}-${line.type || "direct"}-${line.landingName || "direct"}-${index}`;
                  const isLinkExpanded = expandedLineKey === lineKey;

                  return (
                    <div
                      key={lineKey}
                      className={`grid min-w-0 gap-3 border-b border-default-200/60 px-4 py-3 last:border-b-0 sm:px-5 xl:items-center xl:gap-4 xl:px-4 ${LINE_GRID_CLASS} ${stopped ? "opacity-70" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="hidden text-lg leading-none text-default-400 xl:inline"
                          >
                            ›
                          </span>
                          <Chip
                            className="shrink-0"
                            color={isRelay ? "warning" : "primary"}
                            size="sm"
                            variant="flat"
                          >
                            {lineLabel}
                          </Chip>
                          <span className="min-w-0 truncate font-semibold">
                            {nodeName}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-default-500 xl:pl-7">
                          {lineDescription}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm xl:block">
                        <span className="text-xs text-default-500 xl:hidden">
                          协议数量
                        </span>
                        <span className="font-semibold">{protocolCount}</span>
                        <span className="text-default-400 xl:hidden">个</span>
                      </div>

                      <div className="min-w-0 text-sm">
                        <div className="flex items-baseline justify-between gap-2 xl:block">
                          <span className="text-xs text-default-500 xl:hidden">
                            流量使用
                          </span>
                          <span className="font-semibold">{fmtGB(used)}</span>
                          <span className="text-default-400">
                            {quotaGb > 0 ? ` / ${quotaGb} GB` : " / 不限"}
                          </span>
                        </div>
                        {quotaGb > 0 && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default-200/70">
                            <div
                              className={`h-full rounded-full ${percentage > 90 ? "bg-danger" : percentage > 70 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm xl:block">
                        <span className="text-xs text-default-500 xl:hidden">
                          到期时间
                        </span>
                        <span className="font-semibold">
                          {line.lineExpTime
                            ? fmtDate(line.lineExpTime)
                            : "永久"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm xl:justify-start">
                        <span className="text-xs text-default-500 xl:hidden">
                          状态
                        </span>
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${stopped ? "bg-danger" : "bg-success"}`}
                          />
                          <span
                            className={stopped ? "text-danger" : "text-success"}
                          >
                            {stopped ? "已停用" : "运行中"}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 xl:justify-end">
                        <span className="w-full text-xs text-default-500 xl:hidden">
                          操作
                        </span>
                        <Button
                          color="default"
                          size="sm"
                          variant="light"
                          onPress={() =>
                            setExpandedLineKey(isLinkExpanded ? null : lineKey)
                          }
                        >
                          {isLinkExpanded ? "收起" : "链接"}
                        </Button>
                        <Button
                          color="primary"
                          isDisabled={!url}
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            copySubscription(url, "已复制,去客户端粘贴")
                          }
                        >
                          复制
                        </Button>
                        <SubQrToggle size={120} url={url} />
                      </div>

                      {isLinkExpanded && (
                        <div className="min-w-0 xl:col-span-6">
                          <Input
                            readOnly
                            className="mt-2 w-full"
                            isDisabled={!url}
                            placeholder="暂无订阅地址"
                            size="sm"
                            value={url}
                            onClick={(event) => event.currentTarget.select()}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Card className="border border-default-200/70 bg-black/10 dark:bg-white/[0.03]">
        <CardBody className="gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>如何使用订阅链接</span>
            <span aria-hidden="true" className="text-xs text-default-400">
              ?
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <div className="font-medium">v2rayN (Windows)</div>
              <div className="mt-1 text-xs leading-5 text-default-500">
                订阅 → 订阅分组设置 → 添加 → 粘贴地址 → 确定 → 更新订阅
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium">小火箭 / Shadowrocket (iOS)</div>
              <div className="mt-1 text-xs leading-5 text-default-500">
                右上角 + → 类型选「Subscribe」→ 粘贴地址 → 完成
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium">v2rayNG (安卓)</div>
              <div className="mt-1 text-xs leading-5 text-default-500">
                左侧菜单 → 订阅分组设置 → + → 粘贴地址 → 更新订阅
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium">Clash Verge / Clash Meta</div>
              <div className="mt-1 text-xs leading-5 text-default-500">
                配置 → 新建订阅 → 粘贴地址 → 保存 → 更新
              </div>
            </div>
          </div>
          <div className="border-t border-default-200/60 pt-3 text-xs leading-5 text-default-500">
            每条线路是独立的套餐:流量、到期各算各的,一条用完不影响另一条。管理员在某条线路上加了新协议,你更新订阅就会自动出现。
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
