import type {
  TransparentRelay,
  TransparentRelayStatusResponse,
} from "../types";

export type TransparentRelayStatusLevel = "success" | "warning" | "danger";

export interface TransparentRelayStatusCheck {
  ok: boolean;
  label: string;
  description: string;
}

export interface TransparentRelayStatusRoute {
  protocol: "tcp" | "udp";
  protocolLabel: string;
  entryPort: number;
  targetHost: string;
  targetPort: number;
  target: string;
  packets: number;
  bytes: number;
  flowText: string;
  active: boolean;
  relayName?: string;
}

export interface TransparentRelayStatusSummary {
  level: TransparentRelayStatusLevel;
  title: string;
  description: string;
  ipForward: TransparentRelayStatusCheck;
  table: TransparentRelayStatusCheck;
  routes: TransparentRelayStatusRoute[];
  pathText: string;
  rawRuleset: string;
}

const PROTOCOL_ORDER: Record<TransparentRelayStatusRoute["protocol"], number> =
  { tcp: 0, udp: 1 };

export const summarizeTransparentRelayStatus = (
  status: TransparentRelayStatusResponse,
  relays: TransparentRelay[] = [],
): TransparentRelayStatusSummary => {
  const rawRuleset = status.ruleset || "";
  const routes = parseTransparentRelayRoutes(rawRuleset)
    .map((route) => ({ ...route, relayName: findRelayName(route, relays) }))
    .sort(
      (a, b) =>
        a.entryPort - b.entryPort ||
        PROTOCOL_ORDER[a.protocol] - PROTOCOL_ORDER[b.protocol],
    );
  const ipForwardOk = status.ipForward === true;
  const tableOk = status.exists === true;
  const firstRoute = routes[0];
  const level = resolveLevel(ipForwardOk, tableOk, routes.length);
  const title = resolveTitle(level, ipForwardOk, tableOk, routes.length);
  const description = resolveDescription(
    ipForwardOk,
    tableOk,
    routes,
    rawRuleset,
  );

  return {
    level,
    title,
    description,
    ipForward: {
      ok: ipForwardOk,
      label: ipForwardOk ? "已开启" : "未开启",
      description: ipForwardOk
        ? "入口节点允许转发流量。"
        : "入口节点现在不能把收到的包继续转给目标服务器。",
    },
    table: {
      ok: tableOk,
      label: tableOk ? "已下发" : "未发现",
      description: tableOk
        ? "TMS 管理的透明中转规则表存在。"
        : rawRuleset.trim()
          ? `节点返回: ${rawRuleset.trim()}`
          : "没有在节点上看到透明中转规则。",
    },
    routes,
    pathText: firstRoute
      ? `客户端 → 入口节点:${firstRoute.entryPort} → ${firstRoute.target} → 真实出口`
      : "客户端 → 入口节点 → 目标服务器 → 真实出口",
    rawRuleset,
  };
};

const parseTransparentRelayRoutes = (
  ruleset: string,
): TransparentRelayStatusRoute[] => {
  const routes: TransparentRelayStatusRoute[] = [];
  const dnatLine =
    /\b(tcp|udp)\s+dport\s+(\d+)\s+(?:counter\s+packets\s+(\d+)\s+bytes\s+(\d+)\s+)?dnat\s+to\s+([^\s:]+):(\d+)/gi;
  let match: RegExpExecArray | null;

  while ((match = dnatLine.exec(ruleset)) !== null) {
    const protocol =
      match[1].toLowerCase() as TransparentRelayStatusRoute["protocol"];
    const packets = Number(match[3] || 0);
    const bytes = Number(match[4] || 0);
    const targetHost = match[5];
    const targetPort = Number(match[6]);

    routes.push({
      protocol,
      protocolLabel: protocol.toUpperCase(),
      entryPort: Number(match[2]),
      targetHost,
      targetPort,
      target: `${targetHost}:${targetPort}`,
      packets,
      bytes,
      flowText:
        packets > 0 || bytes > 0
          ? `${packets} 包 / ${formatBytes(bytes)}`
          : "暂无流量",
      active: packets > 0 || bytes > 0,
    });
  }

  return routes;
};

const findRelayName = (
  route: TransparentRelayStatusRoute,
  relays: TransparentRelay[],
) => {
  return relays.find((relay) => {
    if (relay.status === 0) return false;
    if (relay.entryPort !== route.entryPort) return false;
    if (
      relay.targetHost !== route.targetHost ||
      relay.targetPort !== route.targetPort
    )
      return false;

    return relay.protocol === "tcp_udp" || relay.protocol === route.protocol;
  })?.name;
};

const resolveLevel = (
  ipForwardOk: boolean,
  tableOk: boolean,
  routeCount: number,
): TransparentRelayStatusLevel => {
  if (!ipForwardOk || !tableOk) return "danger";
  if (routeCount === 0) return "warning";

  return "success";
};

const resolveTitle = (
  level: TransparentRelayStatusLevel,
  ipForwardOk: boolean,
  tableOk: boolean,
  routeCount: number,
) => {
  if (level === "success") return "规则已生效";
  if (!tableOk) return "没有看到转发规则";
  if (!ipForwardOk) return "系统转发未开启";
  if (routeCount === 0) return "规则表为空";

  return "需要检查";
};

const resolveDescription = (
  ipForwardOk: boolean,
  tableOk: boolean,
  routes: TransparentRelayStatusRoute[],
  rawRuleset: string,
) => {
  if (!tableOk)
    return "没有在节点上看到透明中转规则，可能还没下发、已暂停，或节点没有成功应用。";
  if (!ipForwardOk)
    return "系统 IP 转发未开启，入口机收到了流量也不能继续转给目标服务器。";
  if (routes.length === 0)
    return rawRuleset.trim()
      ? "规则表存在，但没有解析到端口转发规则。"
      : "规则表存在，但当前没有启用的透明中转端口。";

  const firstRoute = routes[0];
  const activeCount = routes.filter((route) => route.active).length;

  return `客户端访问入口端口 ${firstRoute.entryPort} 时，会被转到 ${firstRoute.target}；当前 ${activeCount}/${routes.length} 条协议规则已有流量。`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${trimNumber(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${trimNumber(bytes / 1024 / 1024)} MB`;

  return `${trimNumber(bytes / 1024 / 1024 / 1024)} GB`;
};

const trimNumber = (value: number) => {
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
};
