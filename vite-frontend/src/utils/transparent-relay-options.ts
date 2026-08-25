export type ProxyProtocol =
  | "vless"
  | "trojan"
  | "vmess"
  | "shadowsocks"
  | "hysteria2"
  | "tuic"
  | "anytls";

export const UDP_QUIC_PROXY_PROTOCOLS = new Set<ProxyProtocol>([
  "hysteria2",
  "tuic",
]);

export const isUdpQuicProxyProtocol = (protocol?: string | null) =>
  UDP_QUIC_PROXY_PROTOCOLS.has(
    String(protocol || "")
      .trim()
      .toLowerCase() as ProxyProtocol,
  );

export type TransparentRelayNodeLike = {
  id: number;
  name?: string;
  ip?: string;
  serverIp?: string;
  country?: string;
};

export type TargetHostOption = {
  key: string;
  value: string;
  nodeId: number;
  label: string;
};

export const isUsableIpv4 = (value?: string) => {
  const ip = value?.trim();

  if (!ip || ip === "127.0.0.1" || ip.startsWith("127.")) return false;
  const parts = ip.split(".");

  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);

    return n >= 0 && n <= 255;
  });
};

export const buildTargetHostOptions = (
  nodes: TransparentRelayNodeLike[],
): TargetHostOption[] => {
  const candidates = new Map<
    string,
    { node: TransparentRelayNodeLike; ip: string; kinds: Set<string> }
  >();

  const add = (
    node: TransparentRelayNodeLike,
    value: string | undefined,
    kind: string,
  ) => {
    const ip = value?.trim();

    if (!isUsableIpv4(ip)) return;
    const key = `${node.id}:${ip}`;
    const existing = candidates.get(key);

    if (existing) {
      existing.kinds.add(kind);

      return;
    }

    candidates.set(key, { node, ip: ip!, kinds: new Set([kind]) });
  };

  nodes.forEach((node) => {
    add(node, node.serverIp, "服务器IP");
    String(node.ip || "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
      .forEach((ip) => add(node, ip, "入口IP"));
  });

  return Array.from(candidates.entries()).map(([key, item]) => {
    const country = item.node.country ? ` ${item.node.country}` : "";
    const nodeName = item.node.name || `节点 ${item.node.id}`;

    return {
      key,
      value: item.ip,
      nodeId: item.node.id,
      label: `${nodeName}${country} · ${Array.from(item.kinds).join("/")} · ${item.ip}`,
    };
  });
};
