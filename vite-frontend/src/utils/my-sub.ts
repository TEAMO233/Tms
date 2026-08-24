export interface TransparentForward {
  id?: number;
  name?: string;
  tunnelId?: number;
  tunnelName?: string;
  inIp?: string;
  inPort?: number;
  remoteAddr?: string;
  status?: number;
}

export interface TransparentForwardEntry {
  id?: number;
  name: string;
  address: string;
  remoteAddr: string;
}

export interface TransparentGroup {
  tunnelId?: number;
  tunnelName: string;
  entries: TransparentForwardEntry[];
  compositeText: string;
}

/** 搭协议/搭中转自动生成的内部转发已经由协议订阅展示,这里不要重复露给车友。 */
export function isProtocolManagedForward(forward: TransparentForward): boolean {
  if (forward.name && /^inbound-\d+-user-\d+$/.test(forward.name)) {
    return true;
  }
  return !!forward.tunnelName && forward.tunnelName.startsWith("inbound-tunnel-node");
}

export function formatForwardAddress(ip: string, port: number): string {
  const trimmedIp = (ip || "").trim();
  if (!trimmedIp || !port) {
    return "";
  }
  const host = trimmedIp.includes(":") && !trimmedIp.startsWith("[") ? `[${trimmedIp}]` : trimmedIp;
  return `${host}:${port}`;
}

function forwardEntries(forward: TransparentForward): TransparentForwardEntry[] {
  const ips = (forward.inIp || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  const port = Number(forward.inPort || 0);
  if (!ips.length || !port) {
    return [];
  }
  return ips
    .map((ip) => formatForwardAddress(ip, port))
    .filter(Boolean)
    .map((address) => ({
      id: forward.id,
      name: forward.name || `转发#${forward.id ?? ""}`.trim(),
      address,
      remoteAddr: forward.remoteAddr || "",
    }));
}

export function buildTransparentGroups(forwards: TransparentForward[] = []): TransparentGroup[] {
  const groups = new Map<string, TransparentGroup>();

  forwards.forEach((forward) => {
    // 透明中转复合订阅只展示正在工作的手工端口/隧道转发。
    if (forward.status !== undefined && forward.status !== 1) {
      return;
    }
    if (isProtocolManagedForward(forward)) {
      return;
    }

    const entries = forwardEntries(forward);
    if (!entries.length) {
      return;
    }

    const key = `${forward.tunnelId ?? "unknown"}|${forward.tunnelName || "未命名透明中转"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        tunnelId: forward.tunnelId,
        tunnelName: forward.tunnelName || "未命名透明中转",
        entries: [],
        compositeText: "",
      });
    }
    groups.get(key)!.entries.push(...entries);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    compositeText: group.entries
      .map((entry) => `${entry.name} | ${entry.address}`)
      .join("\n"),
  }));
}
