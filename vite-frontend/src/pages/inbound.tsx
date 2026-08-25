import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { DatePicker } from "@heroui/date-picker";
import { parseDate } from "@internationalized/date";
import toast from "react-hot-toast";

import {
  getInboundList,
  createInbound,
  oneClickInbound,
  deleteInboundsByNode,
  assignAllToUser,
  assignSelf,
  getNodeList,
  getAllUsers,
  getSpeedLimitList,
} from "@/api";
import { copyTextToClipboard } from "@/utils/clipboard";
import { SNI_PRESETS, DEFAULT_SNI, cleanSni } from "@/config/sni";
import { SubQr } from "@/components/sub-qr";
import {
  DeleteIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import DeviceDesktop from "@spectrum-icons/workflow/DeviceDesktop";
import MoreVertical from "@spectrum-icons/workflow/MoreVertical";
import Refresh from "@spectrum-icons/workflow/Refresh";
import AlertCircle from "@spectrum-icons/workflow/AlertCircle";
import CheckmarkCircle from "@spectrum-icons/workflow/CheckmarkCircle";
import LinkCheck from "@spectrum-icons/workflow/LinkCheck";
import ChevronDown from "@spectrum-icons/workflow/ChevronDown";
import ChevronUp from "@spectrum-icons/workflow/ChevronUp";
import ChevronLeft from "@spectrum-icons/workflow/ChevronLeft";
import ChevronRight from "@spectrum-icons/workflow/ChevronRight";
import ColumnSettings from "@spectrum-icons/workflow/ColumnSettings";
import Copy from "@spectrum-icons/workflow/Copy";

const isProtocolDesignPreview =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") ===
    "protocol-board";

const protocolDesignPreviewNodes = [
  {
    id: 1,
    name: "本机",
    machineId: "local-node",
    nodeType: "local",
    ip: "140.245.126.119",
    serverIp: "140.245.126.119",
    version: "1.9.3",
    status: 1,
    singboxRunning: true,
    uptime: "Uptime 2d 14h",
    assignedUsers: 5,
    protocolTotal: 6,
    protocolHealthy: 6,
  },
  {
    id: 2,
    name: "vmss日本",
    machineId: "node-002",
    nodeType: "cloud",
    ip: "64.83.37.138",
    serverIp: "64.83.37.138",
    version: "1.9.3",
    status: 1,
    singboxRunning: true,
    uptime: "Uptime 7d 8h",
    assignedUsers: 8,
    protocolTotal: 6,
    protocolHealthy: 6,
  },
  {
    id: 3,
    name: "加坡01",
    machineId: "node-003",
    nodeType: "cloud",
    ip: "103.226.15.90",
    serverIp: "103.226.15.90",
    version: "1.8.7",
    status: 1,
    singboxRunning: true,
    uptime: "Uptime 3d 2h",
    assignedUsers: 3,
    protocolTotal: 6,
    protocolHealthy: 5,
  },
  {
    id: 4,
    name: "美国洛杉矶",
    machineId: "node-004",
    nodeType: "cloud",
    ip: "154.16.23.11",
    serverIp: "154.16.23.11",
    version: "1.8.7",
    status: 0,
    singboxRunning: false,
    lastOnline: "最后在线：1d 6h 前",
    assignedUsers: 0,
    protocolTotal: 6,
    protocolHealthy: 0,
  },
  {
    id: 5,
    name: "香港-02",
    machineId: "node-005",
    nodeType: "cloud",
    ip: "45.76.98.54",
    serverIp: "45.76.98.54",
    version: "1.9.3",
    status: 1,
    singboxRunning: true,
    uptime: "Uptime 12h 33m",
    assignedUsers: 2,
    protocolTotal: 6,
    protocolHealthy: 6,
  },
  {
    id: 6,
    name: "德国法兰克福",
    machineId: "node-006",
    nodeType: "cloud",
    ip: "80.81.193.64",
    serverIp: "80.81.193.64",
    version: "1.8.7",
    status: 0,
    singboxRunning: false,
    lastOnline: "最后在线：3d 22h 前",
    assignedUsers: 0,
    protocolTotal: 6,
    protocolHealthy: 0,
  },
];

const protocolDesignPreviewInbounds = [
  [1, "vless", 443, "reality"],
  [1, "trojan", 8443, "reality"],
  [1, "vmess", 80, "none"],
  [1, "hysteria2", 8444, "tls"],
  [1, "tuic", 2096, "tls"],
  [1, "anytls", 2053, "tls"],
  [2, "vless", 443, "reality"],
  [2, "trojan", 8443, "reality"],
  [2, "vmess", 80, "none"],
  [2, "hysteria2", 8444, "tls"],
  [2, "tuic", 2096, "tls"],
  [2, "anytls", 2053, "tls"],
  [3, "vless", 443, "reality"],
  [3, "trojan", 8443, "reality"],
  [3, "vmess", 80, "none"],
  [3, "hysteria2", 8444, "tls"],
  [3, "tuic", 2096, "tls"],
  [3, "anytls", 2053, "tls"],
  [4, "vless", 443, "reality"],
  [4, "trojan", 8443, "reality"],
  [4, "vmess", 80, "none"],
  [4, "hysteria2", 8444, "tls"],
  [4, "tuic", 2096, "tls"],
  [4, "anytls", 2053, "tls"],
  [5, "vless", 443, "reality"],
  [5, "trojan", 8443, "reality"],
  [5, "vmess", 80, "none"],
  [5, "hysteria2", 8444, "tls"],
  [5, "tuic", 2096, "tls"],
  [5, "anytls", 2053, "tls"],
  [6, "vless", 443, "reality"],
  [6, "trojan", 8443, "reality"],
  [6, "vmess", 80, "none"],
  [6, "hysteria2", 8444, "tls"],
  [6, "tuic", 2096, "tls"],
  [6, "anytls", 2053, "tls"],
].map(([nodeId, protocol, listenPort, security], index) => ({
  id: 1000 + index,
  nodeId,
  protocol,
  listenPort,
  security,
  status: nodeId === 3 && protocol === "anytls" ? 0 : 1,
  health: nodeId === 3 && protocol === "anytls" ? "warning" : "healthy",
  sni: security === "reality" ? "www.apple.com" : "",
  remark: "整机协议",
}));

const protocolDesignPreviewUsers = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  user: `车友${String(index + 1).padStart(2, "0")}`,
}));

const protocolTableColumns = [
  { key: "machine", label: "机器", width: "225px" },
  { key: "nodeStatus", label: "节点状态", width: "120px" },
  { key: "ip", label: "IP 地址", width: "180px" },
  {
    key: "protocolStatus",
    label: "协议运行状态（运行 / 总数）",
    width: "232px",
  },
  { key: "protocols", label: "协议列表", width: "minmax(460px, 1fr)" },
  { key: "users", label: "分配用户", width: "175px" },
  { key: "actions", label: "操作", width: "328px" },
];

/**
 * 协议管理(合体面板)· 机器卡模式。
 * 一台机器 = 一张卡(卡上折叠着这台机器的全套协议)。
 * 卡上「分配用户」→ 把这台机器所有协议一次分给车友 → 出一条订阅链接。
 * 车友加这一条订阅,机器上全部协议自动到手,以后加新协议自动更新。
 */
export default function InboundPage() {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [speedRules, setSpeedRules] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<any>({
    nodeId: null,
    protocol: "vless",
    sni: DEFAULT_SNI,
    dest: "",
    remark: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const [oneClickOpen, setOneClickOpen] = useState(false);
  const [oneClickNodeId, setOneClickNodeId] = useState<number | null>(null);
  const [oneClickSni, setOneClickSni] = useState<string>(DEFAULT_SNI);
  const [oneClickLoading, setOneClickLoading] = useState(false);

  // 机器卡「分配用户」:把整台机器的协议分给车友(只分配,链接去「用户管理」拿)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({
    nodeId: null,
    nodeName: "",
    protocolCount: 0,
    userId: null,
    speedId: null,
    expDate: null,
    flowGb: null,
  });
  const [assignLoading, setAssignLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState<number | null>(null);

  // 「我自己用」:一键开给当前管理员自己,完事直接把订阅链接弹出来
  const [selfLoading, setSelfLoading] = useState<number | null>(null);
  const [selfSubUrl, setSelfSubUrl] = useState<string>("");
  const [selfOpen, setSelfOpen] = useState(false);
  // 订阅链接的域名部分永远是【面板地址】,几台机器点出来长得几乎一样,
  // 只有末尾 token 不同 —— 不写清楚是哪台机器,很容易以为"点第二台弹的还是第一台"
  const [selfNodeName, setSelfNodeName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<
    "all" | "healthy" | "warning" | "offline"
  >("all");
  const [protocolFilter, setProtocolFilter] = useState<
    "all" | "healthy" | "warning" | "offline"
  >("all");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(protocolTableColumns.map((column) => [column.key, true])),
  );
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>(
    {},
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const handleAssignSelf = async (nodeId: number, nodeName?: string) => {
    setSelfLoading(nodeId);
    setSelfNodeName(nodeName || "");
    if (isProtocolDesignPreview) {
      setSelfSubUrl(
        `${window.location.origin}/api/v1/open_api/sub?token=preview-${nodeId}`,
      );
      setSelfOpen(true);
      setSelfLoading(null);

      return;
    }
    try {
      const res = await assignSelf({ nodeId });

      if (res.code === 0 && res.data?.subToken) {
        setSelfSubUrl(
          `${window.location.origin}/api/v1/open_api/sub?token=${res.data.subToken}`,
        );
        setSelfOpen(true);
        loadAll();
      } else {
        toast.error(res.msg || "开通失败");
      }
    } catch (e) {
      toast.error("开通失败");
    }
    setSelfLoading(null);
  };

  const loadAll = async () => {
    if (isProtocolDesignPreview) {
      setInbounds(protocolDesignPreviewInbounds);
      setNodes(protocolDesignPreviewNodes);
      setUsers(protocolDesignPreviewUsers);
      setSpeedRules([]);
      setLastLoadedAt(Date.now());

      return;
    }
    try {
      const [ib, nd, us, sp] = await Promise.all([
        getInboundList(),
        getNodeList(),
        getAllUsers(),
        getSpeedLimitList(),
      ]);

      if (ib.code === 0) setInbounds(ib.data || []);
      if (nd.code === 0) setNodes(nd.data || []);
      if (us.code === 0) {
        const d: any = us.data;

        setUsers(Array.isArray(d) ? d : d && d.records ? d.records : []);
      }
      if (sp.code === 0) setSpeedRules(sp.data || []);
      setLastLoadedAt(Date.now());
    } catch (e) {
      toast.error("加载失败");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const protoLabel = (p: string) =>
    (
      ({
        vless: "VLESS-Reality",
        trojan: "Trojan-Reality",
        vmess: "VMess",
        shadowsocks: "Shadowsocks-2022",
        hysteria2: "Hysteria2",
        tuic: "TUIC",
        anytls: "AnyTLS",
      }) as any
    )[p] || p;
  const isReality = (p: string) => p === "vless" || p === "trojan";

  const handleCreate = async () => {
    if (!createForm.nodeId) return toast.error("请选择节点");
    if (isReality(createForm.protocol) && !createForm.sni)
      return toast.error("Reality 协议需要填 SNI");
    setCreateLoading(true);
    if (isProtocolDesignPreview) {
      toast.success("预览模式：协议创建流程已触发");
      setCreateOpen(false);
      setCreateLoading(false);

      return;
    }
    try {
      const payload: any = {
        nodeId: createForm.nodeId,
        protocol: createForm.protocol,
        remark: createForm.remark,
      };

      if (isReality(createForm.protocol)) {
        payload.sni = cleanSni(createForm.sni);
        payload.dest = createForm.dest;
      }
      const res = await createInbound(payload);

      if (res.code === 0) {
        toast.success("入站已创建");
        setCreateOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "创建失败");
      }
    } catch (e) {
      toast.error("创建失败");
    }
    setCreateLoading(false);
  };

  const handleOneClick = async () => {
    if (!oneClickNodeId) return toast.error("请选择节点");
    setOneClickLoading(true);
    if (isProtocolDesignPreview) {
      toast.success("预览模式：一键搭建流程已触发");
      setOneClickOpen(false);
      setOneClickLoading(false);

      return;
    }
    try {
      const res = await oneClickInbound(oneClickNodeId, cleanSni(oneClickSni));

      if (res.code === 0) {
        toast.success("一键添加完成:整机全套协议已建好");
        setOneClickOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "一键添加失败");
      }
    } catch (e) {
      toast.error("一键添加失败");
    }
    setOneClickLoading(false);
  };

  const openNodeAssign = (n: any, count: number) => {
    setAssignForm({
      nodeId: n.id,
      nodeName: n.name,
      protocolCount: count,
      userId: null,
      speedId: null,
      expDate: null,
      flowGb: null,
    });
    setAssignOpen(true);
  };

  const handleNodeAssign = async () => {
    if (!assignForm.userId) return toast.error("请选择车友");
    setAssignLoading(true);
    if (isProtocolDesignPreview) {
      toast.success("预览模式：整机分配流程已触发");
      setAssignOpen(false);
      setAssignLoading(false);

      return;
    }
    try {
      const payload: any = {
        userId: assignForm.userId,
        nodeId: assignForm.nodeId,
      };

      if (assignForm.speedId) payload.speedId = assignForm.speedId;
      // 到期直接选日期(当天 23:59:59 截止),比填"多少天"直观,续费也只是把日期往后改
      if (assignForm.expDate)
        payload.expTime = new Date(`${assignForm.expDate}T23:59:59`).getTime();
      if (assignForm.flowGb) payload.flow = Math.round(assignForm.flowGb); // 单位 GB(线路配额按 GB 存)
      const res = await assignAllToUser(payload);

      if (res.code === 0) {
        {
          const a = res.data?.assigned ?? 0,
            u = res.data?.updated ?? 0;

          toast.success(
            a > 0
              ? `已分配 ${a} 个协议` +
                  (u ? `,更新 ${u} 个` : "") +
                  " · 订阅链接去「用户管理」拿"
              : u > 0
                ? `已更新这条线路的限速/到期/流量(${u} 个协议)`
                : "配额和到期已更新",
          );
        }
        setAssignOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch (e) {
      toast.error("分配失败");
    }
    setAssignLoading(false);
  };

  const handleClearNode = async (nodeId: number, nodeName: string) => {
    if (
      !window.confirm(
        `确定清空「${nodeName}」上的直连协议?(连带其转发/用户;中转协议不受影响)`,
      )
    )
      return;
    if (clearLoading !== null) return;
    setClearLoading(nodeId);
    if (isProtocolDesignPreview) {
      toast.success("预览模式：清空流程已触发");
      setClearLoading(null);

      return;
    }
    try {
      const res = await deleteInboundsByNode(nodeId, false);

      if (res.code === 0) {
        toast.success("已清空该机协议");
        loadAll();
      } else {
        toast.error(res.msg || "清空失败");
      }
    } catch (e) {
      toast.error("清空请求超时,请刷新确认实际状态");
    } finally {
      setClearLoading(null);
    }
  };

  const handleCopyNodeIp = async (ip: string) => {
    if (!ip) return;
    const copied = await copyTextToClipboard(ip);

    copied ? toast.success("IP 地址已复制") : toast.error("复制失败");
  };

  // 协议管理只管【直连】协议(landingId 为空);中转的协议在「中转」页管
  const machineNodes = nodes.filter((n) =>
    inbounds.some((ib) => ib.nodeId === n.id && !ib.landingId),
  );

  const getNodeInbounds = (nodeId: number) =>
    inbounds.filter((ib) => ib.nodeId === nodeId && !ib.landingId);

  const getNodeProtocolTotal = (node: any, nodeInbounds = getNodeInbounds(node.id)) =>
    typeof node.protocolTotal === "number" ? node.protocolTotal : nodeInbounds.length;

  const getNodeHealthyProtocolCount = (
    node: any,
    nodeInbounds = getNodeInbounds(node.id),
  ) => {
    if (typeof node.protocolHealthy === "number") return node.protocolHealthy;

    return nodeInbounds.filter((inbound) => inbound.status !== 0).length;
  };

  const getNodeHealth = (node: any): "healthy" | "warning" | "offline" => {
    if (node.status !== 1) return "offline";
    if (node.singboxRunning === false) return "warning";
    if (
      getNodeHealthyProtocolCount(node) <
      getNodeProtocolTotal(node)
    )
      return "warning";

    return "healthy";
  };

  const getInboundHealth = (node: any, inbound: any) => {
    if (node.status !== 1) return "offline";
    if (inbound.health === "warning") return "warning";
    if (node.singboxRunning === false || inbound.status === 0) return "muted";

    return "success";
  };

  const getProtocolState = (node: any, inbound: any) => {
    if (node.status !== 1) return "节点离线";
    if (node.singboxRunning === false) return "sing-box 未运行";
    if (inbound.health === "warning") return "协议异常";
    return inbound.status === 0 ? "已停用" : "运行中";
  };

  const getProtocolStateTone = (node: any, inbound: any) => {
    const health = getInboundHealth(node, inbound);

    if (health !== "success") return "muted";

    return inbound.status === 0 ? "muted" : "success";
  };

  const protocolTotal = machineNodes.reduce(
    (sum, node) => sum + getNodeInbounds(node.id).length,
    0,
  );
  const onlineNodeCount = machineNodes.filter((node) => node.status === 1).length;
  const runtimeIssueCount = machineNodes.filter(
    (node) => getNodeHealth(node) !== "healthy",
  ).length;
  const runningProtocolCount = machineNodes.reduce(
    (sum, node) =>
      sum +
      getNodeInbounds(node.id).filter(
        (inbound) =>
          node.status === 1 &&
          node.singboxRunning !== false &&
          inbound.status !== 0,
      ).length,
    0,
  );

  const filteredMachineNodes = machineNodes.filter((node) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [node.name, node.ip, node.serverIp, node.domain]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesHealth =
      healthFilter === "all" || getNodeHealth(node) === healthFilter;
    const matchesProtocol =
      protocolFilter === "all" ||
      (protocolFilter === "healthy" && getNodeHealth(node) === "healthy") ||
      (protocolFilter === "warning" && getNodeHealth(node) === "warning") ||
      (protocolFilter === "offline" && getNodeHealth(node) === "offline");
    const matchesNodeType =
      nodeTypeFilter === "all" || (node.nodeType || "cloud") === nodeTypeFilter;

    return matchesQuery && matchesHealth && matchesProtocol && matchesNodeType;
  });

  const visibleTableColumns = protocolTableColumns.filter(
    (column) => visibleColumns[column.key],
  );
  const tableGridTemplate = visibleTableColumns
    .map((column) => column.width)
    .join(" ");
  const pageSize = 10;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMachineNodes.length / pageSize),
  );
  const pagedMachineNodes = filteredMachineNodes.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const summaryOnlineMachineCount = isProtocolDesignPreview ? 2 : onlineNodeCount;
  const summaryProtocolTotal = isProtocolDesignPreview ? 18 : protocolTotal;
  const summaryUnavailableProtocolCount = isProtocolDesignPreview
    ? 2
    : Math.max(0, protocolTotal - runningProtocolCount);

  const resetTableFilters = () => {
    setSearchTerm("");
    setHealthFilter("all");
    setProtocolFilter("all");
    setNodeTypeFilter("all");
    setPage(1);
  };

  const formatLastLoaded = () => {
    if (!lastLoadedAt) return "等待首次同步";
    return `最后同步 ${new Date(lastLoadedAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  };

  return (
    <div className="protocol-command-board">
      <section className="protocol-operations-table">
        <div className="protocol-operations-header">
          <div>
            <h1 className="protocol-operations-title">
              线路总览 <span>/ Operations Table</span>
            </h1>
            <p className="protocol-operations-subtitle">
              按机器维度管理协议运行状态、分配用户与执行常用操作。
            </p>
          </div>
          <div className="protocol-operations-actions">
            <Button
              className="protocol-operations-primary"
              color="secondary"
              startContent={<PlusIcon size={16} />}
              onPress={() => {
                setOneClickNodeId(null);
                setOneClickOpen(true);
              }}
            >
              一键搭建整机协议
            </Button>
            <Button
              className="protocol-operations-secondary"
              color="primary"
              startContent={<PlusIcon size={16} />}
              onPress={() => {
                setCreateForm({
                  nodeId: null,
                  protocol: "vless",
                  sni: DEFAULT_SNI,
                  dest: "",
                  remark: "",
                });
                setCreateOpen(true);
              }}
            >
              单独加一个协议
            </Button>
          </div>
        </div>

        <section className="protocol-operations-summary" aria-label="线路运行概览">
          <div className="protocol-operations-summary-item">
            <span className="protocol-operations-summary-icon protocol-summary-blue">
              <DeviceDesktop size="S" />
            </span>
            <span>
              <small>在线机器</small>
              <strong>
                {summaryOnlineMachineCount} / {machineNodes.length}
              </strong>
              <em>
                {summaryOnlineMachineCount} 台在线 / 共 {machineNodes.length} 台
              </em>
            </span>
          </div>
          <div className="protocol-operations-summary-item">
            <span className="protocol-operations-summary-icon protocol-summary-purple">
              <LinkCheck size="S" />
            </span>
            <span>
              <small>协议总数</small>
              <strong>{summaryProtocolTotal}</strong>
              <em>{summaryProtocolTotal} 个协议在运行</em>
            </span>
          </div>
          <div className="protocol-operations-summary-item protocol-operations-summary-last">
            <span className="protocol-operations-summary-icon protocol-summary-amber">
              <AlertCircle size="S" />
            </span>
            <span>
              <small>不可用协议</small>
              <strong>{summaryUnavailableProtocolCount}</strong>
              <em>{summaryUnavailableProtocolCount} 个协议异常</em>
            </span>
          </div>
        </section>

        <div className="protocol-operations-toolbar">
          <div className="protocol-operations-toolbar-left">
            <label className="protocol-operations-search">
              <SearchIcon size={16} />
              <input
                aria-label="搜索机器名称或 IP"
                placeholder="搜索机器名称 / IP"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="筛选节点状态"
              className="protocol-operations-select"
              value={healthFilter}
              onChange={(event) => {
                setHealthFilter(
                  event.target.value as "all" | "healthy" | "warning" | "offline",
                );
                setPage(1);
              }}
            >
              <option value="all">状态　　全部</option>
              <option value="healthy">状态　　在线</option>
              <option value="warning">状态　　异常</option>
              <option value="offline">状态　　离线</option>
            </select>
            <select
              aria-label="筛选协议健康度"
              className="protocol-operations-select"
              value={protocolFilter}
              onChange={(event) => {
                setProtocolFilter(
                  event.target.value as "all" | "healthy" | "warning" | "offline",
                );
                setPage(1);
              }}
            >
              <option value="all">协议健康度　全部</option>
              <option value="healthy">协议健康度　全部健康</option>
              <option value="warning">协议健康度　有异常</option>
              <option value="offline">协议健康度　节点离线</option>
            </select>
            <select
              aria-label="筛选节点类型"
              className="protocol-operations-select"
              value={nodeTypeFilter}
              onChange={(event) => {
                setNodeTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">节点类型　全部</option>
              <option value="local">节点类型　本机</option>
              <option value="cloud">节点类型　云服务器</option>
            </select>
            <button className="protocol-operations-reset" type="button" onClick={resetTableFilters}>
              重置
            </button>
          </div>
          <div className="protocol-operations-toolbar-right">
            <Button
              className="protocol-operations-toolbar-button"
              startContent={<Refresh size="S" />}
              variant="flat"
              onPress={loadAll}
            >
              刷新
            </Button>
            <div className="protocol-column-settings-control">
              <button
                aria-expanded={columnSettingsOpen}
                className="protocol-operations-toolbar-button"
                type="button"
                onClick={() => setColumnSettingsOpen((open) => !open)}
              >
                <ColumnSettings size="S" />
                列设置
              </button>
              {columnSettingsOpen && (
                <div className="protocol-column-settings-menu">
                  <strong>显示列</strong>
                  {protocolTableColumns.map((column) => (
                    <label key={column.key}>
                      <input
                        checked={Boolean(visibleColumns[column.key])}
                        disabled={column.key === "machine" || column.key === "actions"}
                        type="checkbox"
                        onChange={() =>
                          setVisibleColumns((current) => ({
                            ...current,
                            [column.key]: !current[column.key],
                          }))
                        }
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="protocol-operations-table-scroll">
          <div className="protocol-operations-table-grid protocol-operations-table-head" role="table">
            <div
              className="protocol-operations-table-grid protocol-operations-table-header-row"
              role="row"
              style={{ gridTemplateColumns: tableGridTemplate }}
            >
              {visibleTableColumns.map((column) => (
                <div key={column.key} role="columnheader">
                  {column.label}
                </div>
              ))}
            </div>

            {pagedMachineNodes.map((n) => {
              const nodeInbounds = getNodeInbounds(n.id);
              const health = getNodeHealth(n);
              const firstIp = n.ip
                ? String(n.ip).split(",")[0].trim()
                : n.serverIp || "";
              const totalProtocols = getNodeProtocolTotal(n, nodeInbounds);
              const healthyProtocols = getNodeHealthyProtocolCount(n, nodeInbounds);
              const expanded = Boolean(expandedNodes[n.id]);
              const nodeType = n.nodeType || "cloud";
              const assignedUsers =
                typeof n.assignedUsers === "number" ? n.assignedUsers : null;

              return (
                <div
                  key={n.id}
                  className={`protocol-operations-table-grid protocol-operations-table-row protocol-row-${health}`}
                  role="row"
                  style={{ gridTemplateColumns: tableGridTemplate }}
                >
                  {visibleColumns.machine && (
                    <div className="protocol-table-cell protocol-table-machine-cell" role="cell">
                      <DeviceDesktop size="S" />
                      <div>
                        <div className="protocol-table-machine-name">
                          <strong>{n.name}</strong>
                          <span
                            className={`protocol-table-node-tag ${health === "offline" ? "offline" : nodeType}`}
                          >
                            {nodeType === "local" ? "本机" : health === "offline" ? "离线" : "在线"}
                          </span>
                        </div>
                        <small>ID: {n.machineId || n.id}</small>
                      </div>
                    </div>
                  )}

                  {visibleColumns.nodeStatus && (
                    <div className="protocol-table-cell protocol-table-status-cell" role="cell">
                      <div className={`protocol-table-status-label ${health}`}>
                        <span className={`protocol-health-dot ${health}`} />
                        <strong>{health === "offline" ? "离线" : "在线"}</strong>
                      </div>
                      <small>
                        {health === "offline"
                          ? n.lastOnline || "最后在线：未知"
                          : "运行中"}
                      </small>
                      {health !== "offline" && <small>{n.uptime || "Uptime —"}</small>}
                    </div>
                  )}

                  {visibleColumns.ip && (
                    <div className="protocol-table-cell protocol-table-ip-cell" role="cell">
                      <span>{firstIp || "—"}</span>
                      <button
                        aria-label={`复制 ${n.name} IP 地址`}
                        title="复制 IP 地址"
                        type="button"
                        onClick={() => handleCopyNodeIp(firstIp)}
                      >
                        <Copy size="S" />
                      </button>
                    </div>
                  )}

                  {visibleColumns.protocolStatus && (
                    <div className="protocol-table-cell protocol-table-health-cell" role="cell">
                      <div className={`protocol-table-health-count ${health}`}>
                        {health === "healthy" ? (
                          <CheckmarkCircle size="S" />
                        ) : (
                          <AlertCircle size="S" />
                        )}
                        <strong>
                          {healthyProtocols} / {totalProtocols}
                        </strong>
                      </div>
                      <small>
                        {health === "healthy"
                          ? "全部健康"
                          : health === "warning"
                            ? `${Math.max(0, totalProtocols - healthyProtocols)} 个异常`
                            : "节点离线"}
                      </small>
                    </div>
                  )}

                  {visibleColumns.protocols && (
                    <div className="protocol-table-cell protocol-table-protocols-cell" role="cell">
                      <div className="protocol-table-protocol-list">
                        {nodeInbounds.map((ib) => {
                          const protocolHealth = getInboundHealth(n, ib);
                          const protocolName = protoLabel(ib.protocol);

                          return (
                            <span
                              key={ib.id}
                              className={`protocol-table-protocol-chip ${protocolHealth}`}
                              title={`${protocolName} · ${getProtocolState(n, ib)}`}
                            >
                              {protocolHealth === "warning"
                                ? `${protocolName} (异常)`
                                : protocolName}
                            </span>
                          );
                        })}
                        <button
                          aria-label={`给${n.name}添加协议`}
                          className="protocol-table-add-button"
                          title="添加协议"
                          type="button"
                          onClick={() => {
                            setCreateForm({
                              nodeId: n.id,
                              protocol: "vless",
                              sni: DEFAULT_SNI,
                              dest: "",
                              remark: "",
                            });
                            setCreateOpen(true);
                          }}
                        >
                          <PlusIcon size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {visibleColumns.users && (
                    <div className="protocol-table-cell protocol-table-users-cell" role="cell">
                      <div className="protocol-table-user-count">
                        <UserIcon size={15} />
                        <strong>{assignedUsers === null ? "—" : `${assignedUsers} 个用户`}</strong>
                      </div>
                      <button
                        className="protocol-table-detail-link"
                        type="button"
                        onClick={() =>
                          setExpandedNodes((current) => ({
                            ...current,
                            [n.id]: !current[n.id],
                          }))
                        }
                      >
                        {expanded ? "收起详情" : "查看详情"} <ChevronRight size="S" />
                      </button>
                      {expanded && (
                        <div className="protocol-table-inline-detail">
                          {nodeInbounds.map((ib) => protoLabel(ib.protocol)).join("、")}
                        </div>
                      )}
                    </div>
                  )}

                  {visibleColumns.actions && (
                    <div className="protocol-table-cell protocol-table-actions-cell" role="cell">
                      <Button
                        className="protocol-table-action protocol-table-action-assign"
                        size="sm"
                        startContent={<UserIcon size={14} />}
                        onPress={() => openNodeAssign(n, nodeInbounds.length)}
                      >
                        分配用户
                      </Button>
                      <Button
                        className="protocol-table-action protocol-table-action-self"
                        isLoading={selfLoading === n.id}
                        size="sm"
                        variant="flat"
                        onPress={() => handleAssignSelf(n.id, n.name)}
                      >
                        我自己用
                      </Button>
                      <Button
                        className="protocol-table-action protocol-table-action-danger"
                        isDisabled={clearLoading !== null}
                        isLoading={clearLoading === n.id}
                        size="sm"
                        variant="flat"
                        onPress={() => handleClearNode(n.id, n.name)}
                      >
                        清空该机
                      </Button>
                      <button
                        aria-label={`${n.name}更多操作`}
                        className="protocol-table-more"
                        title="更多操作"
                        type="button"
                        onClick={() =>
                          setExpandedNodes((current) => ({
                            ...current,
                            [n.id]: !current[n.id],
                          }))
                        }
                      >
                        <MoreVertical size="S" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {filteredMachineNodes.length === 0 && (
          <div className="protocol-operations-empty">
            <DeviceDesktop size="M" />
            <strong>
              {machineNodes.length === 0 ? "还没有协议机器" : "没有匹配的机器"}
            </strong>
            <span>
              {machineNodes.length === 0
                ? "使用右上角的一键搭建整机协议，在在线机器上快速创建整套协议。"
                : "可以清除搜索词或重置筛选，查看其他机器。"}
            </span>
          </div>
        )}

        <div className="protocol-operations-pagination">
          <span>共 {filteredMachineNodes.length} 条</span>
          <div>
            <select aria-label="每页条数" value={pageSize} disabled onChange={() => undefined}>
              <option value={10}>10 条/页</option>
            </select>
            <button
              aria-label="上一页"
              disabled={page <= 1}
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size="S" />
            </button>
            <span className="protocol-operations-page-number">{Math.min(page, totalPages)}</span>
            <button
              aria-label="下一页"
              disabled={page >= totalPages}
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight size="S" />
            </button>
          </div>
        </div>
      </section>

      <div className="protocol-command-header">
        <div>
          <p className="protocol-kicker">OPERATIONS / PROTOCOLS</p>
          <h1 className="protocol-command-title">
            协议编排 <span>/ Command Board</span>
          </h1>
          <p className="protocol-command-subtitle">
            全局查看与管理各机器上的协议运行与分配状态
          </p>
        </div>
        <div className="protocol-command-actions">
          <Button
            className="protocol-button protocol-button-primary"
            color="secondary"
            startContent={<PlusIcon size={16} />}
            onPress={() => {
              setOneClickNodeId(null);
              setOneClickOpen(true);
            }}
          >
            一键搭建整机协议
          </Button>
          <Button
            className="protocol-button protocol-button-outline"
            color="primary"
            startContent={<PlusIcon size={16} />}
            onPress={() => {
              setCreateForm({
                nodeId: null,
                protocol: "vless",
                sni: DEFAULT_SNI,
                dest: "",
                remark: "",
              });
              setCreateOpen(true);
            }}
          >
            单独加一个协议
          </Button>
        </div>
      </div>

      <div className="protocol-status-strip" aria-label="协议运行概览">
        <div className="protocol-summary-item">
          <span className="protocol-summary-icon protocol-summary-blue">
            <DeviceDesktop size="S" />
          </span>
          <span>
            <small>机器总数</small>
            <strong>{machineNodes.length}</strong>
          </span>
        </div>
        <div className="protocol-summary-item">
          <span className="protocol-summary-icon protocol-summary-green">
            <CheckmarkCircle size="S" />
          </span>
          <span>
            <small>运行中</small>
            <strong>{onlineNodeCount}</strong>
          </span>
        </div>
        <div className="protocol-summary-item">
          <span className="protocol-summary-icon protocol-summary-amber">
            <AlertCircle size="S" />
          </span>
          <span>
            <small>运行异常</small>
            <strong>{runtimeIssueCount}</strong>
          </span>
        </div>
        <div className="protocol-summary-item">
          <span className="protocol-summary-icon protocol-summary-blue">
            <LinkCheck size="S" />
          </span>
          <span>
            <small>协议总数</small>
            <strong>
              {runningProtocolCount}/{protocolTotal}
            </strong>
          </span>
        </div>
        <div className="protocol-summary-item">
          <span className="protocol-summary-icon protocol-summary-purple">
            <UserIcon size={16} />
          </span>
          <span>
            <small>可分配车友</small>
            <strong>{users.length}</strong>
          </span>
        </div>
        <div className="protocol-summary-item protocol-summary-last">
          <span className="protocol-summary-icon protocol-summary-purple">
            <LinkCheck size="S" />
          </span>
          <span>
            <small>整机线路</small>
            <strong>{machineNodes.length}</strong>
          </span>
        </div>
      </div>

      <div className="protocol-board-toolbar">
        <div className="protocol-toolbar-left">
          <label className="protocol-search-field">
            <SearchIcon size={16} />
            <input
              aria-label="搜索机器"
              placeholder="搜索机器名称或 IP"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <select
            aria-label="筛选机器状态"
            className="protocol-filter-select"
            value={healthFilter}
            onChange={(event) =>
              setHealthFilter(
                event.target.value as "all" | "healthy" | "warning" | "offline",
              )
            }
          >
            <option value="all">全部状态</option>
            <option value="healthy">运行正常</option>
            <option value="warning">存在异常</option>
            <option value="offline">节点离线</option>
          </select>
          <span className="protocol-sync-label">{formatLastLoaded()}</span>
        </div>
        <Button
          className="protocol-refresh-button"
          isIconOnly
          aria-label="刷新协议状态"
          title="刷新协议状态"
          variant="flat"
          onPress={loadAll}
        >
          <Refresh size="S" />
        </Button>
      </div>

      <div className="protocol-board-stack">
        {filteredMachineNodes.map((n) => {
          const nodeInbounds = getNodeInbounds(n.id);
          const health = getNodeHealth(n);
          const firstIp = n.ip
            ? String(n.ip).split(",")[0].trim()
            : n.serverIp || "";
          const expanded = Boolean(expandedNodes[n.id]);
          const healthyProtocols = nodeInbounds.filter(
            (inbound) => getProtocolStateTone(n, inbound) === "success",
          ).length;

          return (
            <section
              key={n.id}
              className={`protocol-machine-board protocol-health-${health}`}
            >
              <div className="protocol-machine-meta">
                <div className="protocol-machine-health">
                  <span className={`protocol-health-dot ${health}`} />
                  <span>
                    {health === "healthy"
                      ? "运行中"
                      : health === "warning"
                        ? "部分异常"
                        : "节点离线"}
                  </span>
                </div>
                <div className="protocol-machine-identity">
                  <span className="protocol-machine-icon">
                    <DeviceDesktop size="M" />
                  </span>
                  <div className="protocol-machine-name-block">
                    <div className="protocol-machine-name-row">
                      <h2>{n.name}</h2>
                      <span className={`protocol-node-pill ${health}`}>
                        {n.status === 1 ? "在线" : "离线"}
                      </span>
                    </div>
                    <p>{firstIp || "未配置访问地址"}</p>
                  </div>
                  <button
                    aria-label={`${expanded ? "收起" : "展开"}${n.name}详情`}
                    aria-expanded={expanded}
                    className="protocol-machine-expand"
                    type="button"
                    onClick={() =>
                      setExpandedNodes((current) => ({
                        ...current,
                        [n.id]: !current[n.id],
                      }))
                    }
                  >
                    {expanded ? <ChevronUp size="S" /> : <ChevronDown size="S" />}
                  </button>
                </div>
                <div className="protocol-machine-facts">
                  <div>
                    <span>协议数量</span>
                    <strong>{nodeInbounds.length}</strong>
                  </div>
                  <div>
                    <span>运行状态</span>
                    <strong>
                      {healthyProtocols}/{nodeInbounds.length}
                    </strong>
                  </div>
                </div>
                <div className="protocol-subscription-hint">
                  <span className="protocol-subscription-icon">
                    <LinkCheck size="S" />
                  </span>
                  <span>
                    <strong>整机订阅</strong>
                    <small>新增协议会自动同步</small>
                  </span>
                </div>
              </div>

              <div className="protocol-machine-workspace">
                <div className="protocol-workspace-header">
                  <div>
                    <div className="protocol-workspace-title">
                      协议列表 <span>({nodeInbounds.length})</span>
                    </div>
                    <span className="protocol-workspace-caption">
                      {healthyProtocols}/{nodeInbounds.length} 个协议可用
                    </span>
                  </div>
                  <div className="protocol-machine-actions">
                    <Button
                      className="protocol-action-button protocol-action-assign"
                      color="primary"
                      size="sm"
                      startContent={<UserIcon size={15} />}
                      onPress={() => openNodeAssign(n, nodeInbounds.length)}
                    >
                      分配用户
                    </Button>
                    <Button
                      className="protocol-action-button protocol-action-self"
                      color="success"
                      isLoading={selfLoading === n.id}
                      size="sm"
                      variant="flat"
                      onPress={() => handleAssignSelf(n.id, n.name)}
                    >
                      我自己用
                    </Button>
                    <Button
                      className="protocol-action-button protocol-action-danger"
                      color="danger"
                      isDisabled={clearLoading !== null}
                      isLoading={clearLoading === n.id}
                      size="sm"
                      startContent={<DeleteIcon size={15} />}
                      variant="flat"
                      onPress={() => handleClearNode(n.id, n.name)}
                    >
                      清空该机
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`${n.name}更多操作`}
                      className="protocol-more-button"
                      size="sm"
                      title="更多操作"
                      variant="light"
                      onPress={() =>
                        setExpandedNodes((current) => ({
                          ...current,
                          [n.id]: !current[n.id],
                        }))
                      }
                    >
                      <MoreVertical size="S" />
                    </Button>
                  </div>
                </div>

                {health === "warning" && (
                  <div className="protocol-runtime-warning">
                    <AlertCircle size="S" />
                    <div>
                      <strong>sing-box 未运行，协议暂不可用</strong>
                      <span>
                        节点本身在线，但协议服务没有启动；请在节点上执行
                        <code>systemctl enable --now sing-box</code>
                      </span>
                    </div>
                  </div>
                )}

                {nodeInbounds.length > 0 ? (
                  <div className="protocol-tile-grid">
                    {nodeInbounds.map((ib) => {
                      const state = getProtocolState(n, ib);
                      const tone = getProtocolStateTone(n, ib);

                      return (
                        <div
                          key={ib.id}
                          className={`protocol-tile protocol-tile-${tone}`}
                        >
                          <div className="protocol-tile-heading">
                            <span className="protocol-tile-icon">
                              <LinkCheck size="S" />
                            </span>
                            <strong>{protoLabel(ib.protocol)}</strong>
                            <span className={`protocol-tile-badge ${tone}`}>
                              {ib.status === 0 ? "已停用" : "已启用"}
                            </span>
                          </div>
                          <div className="protocol-tile-status">
                            <span className={`protocol-health-dot ${tone}`} />
                            <span>{state}</span>
                            <span className="protocol-tile-port">
                              {ib.listenPort ? `端口 ${ib.listenPort}` : "端口待同步"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="protocol-empty-state">
                    <span className="protocol-empty-icon">
                      <LinkCheck size="M" />
                    </span>
                    <strong>这台机器还没有协议</strong>
                    <span>可以使用右上角的“一键搭建整机协议”快速创建。</span>
                  </div>
                )}

                {expanded && (
                  <div className="protocol-detail-list">
                    <div className="protocol-detail-heading">协议详情</div>
                    {nodeInbounds.map((ib) => (
                      <div className="protocol-detail-row" key={`detail-${ib.id}`}>
                        <span>{protoLabel(ib.protocol)}</span>
                        <span>{ib.security || "默认安全配置"}</span>
                        <span>{ib.sni || "无需域名"}</span>
                        <span>{ib.remark || "无备注"}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="protocol-workspace-footer">
                  <span>
                    协议变更会自动同步到该机器的整机订阅；中转协议在“中转”页单独管理。
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedNodes((current) => ({
                        ...current,
                        [n.id]: !current[n.id],
                      }))
                    }
                  >
                    {expanded ? "收起详情" : "展开详情"}{" "}
                    {expanded ? <ChevronUp size="S" /> : <ChevronDown size="S" />}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {filteredMachineNodes.length === 0 && (
        <div className="protocol-board-empty">
          <span className="protocol-empty-icon">
            <DeviceDesktop size="M" />
          </span>
          <strong>
            {machineNodes.length === 0 ? "还没有协议机器" : "没有匹配的机器"}
          </strong>
          <span>
            {machineNodes.length === 0
              ? "使用右上角的一键搭建整机协议，在在线机器上快速创建整套协议。"
              : "可以清除搜索词或切换状态筛选，查看其他机器。"}
          </span>
        </div>
      )}

      {/* 「我自己用」结果:直接把订阅链接给出来,不用再去用户管理找 */}
      <Modal isOpen={selfOpen} size="2xl" onClose={() => setSelfOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span>已开给你自己(不限速 · 不限流量 · 不限到期)</span>
            {selfNodeName && (
              <span className="text-sm font-normal text-default-500">
                机器:<b className="text-foreground">{selfNodeName}</b>
              </span>
            )}
          </ModalHeader>
          <ModalBody className="space-y-2">
            <div className="text-sm text-default-500">
              这条订阅是给你自己用的,复制到 v2rayN / 小火箭
              里就能用。以后随时在「我的订阅」页也能找到。
            </div>
            <div className="text-xs text-default-400 bg-default-100 rounded-lg px-3 py-2">
              链接前半段是<b>面板地址</b>,所以每台机器点出来都一样 ——
              真正区分线路的是末尾的
              <b> token</b>。拉下来的节点才是这台机器的。
            </div>
            <Input
              readOnly
              value={selfSubUrl}
              onClick={(e: any) => {
                if (e.target?.select) e.target.select();
              }}
            />
            <SubQr url={selfSubUrl} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setSelfOpen(false)}>
              关闭
            </Button>
            <Button
              color="primary"
              onPress={async () => {
                (await copyTextToClipboard(selfSubUrl))
                  ? toast.success("已复制订阅链接")
                  : toast.error("复制失败,点框内已全选,按 Ctrl+C");
              }}
            >
              复制订阅链接
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 机器卡「分配用户」:整机协议一次分给车友,出一条订阅链接 */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)}>
        <ModalContent>
          <ModalHeader>给车友分配「{assignForm.nodeName}」</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              把这台机器上的 <b>{assignForm.protocolCount} 个协议</b>{" "}
              一次分给车友。分配完到「用户管理」页,点该车友的「订阅链接」拿链接发给他。
            </div>
            <Select
              label="子账号(车友)"
              placeholder="选一个车友"
              selectedKeys={
                assignForm.userId ? [String(assignForm.userId)] : []
              }
              onSelectionChange={(k) =>
                setAssignForm({
                  ...assignForm,
                  userId: Number(Array.from(k)[0]),
                })
              }
            >
              {users.map((u) => (
                <SelectItem key={u.id}>{u.user}</SelectItem>
              ))}
            </Select>
            <Select
              label="限速规则(可空)"
              placeholder="不限速"
              selectedKeys={
                assignForm.speedId ? [String(assignForm.speedId)] : []
              }
              onSelectionChange={(k) =>
                setAssignForm({
                  ...assignForm,
                  speedId: Number(Array.from(k)[0]),
                })
              }
            >
              {speedRules.map((s) => (
                <SelectItem key={s.id}>{s.name}</SelectItem>
              ))}
            </Select>
            <DatePicker
              showMonthAndYearPickers
              className="cursor-pointer"
              description="到这天 23:59 自动停;续费直接把日期往后改再点一次分配"
              label="到期日期(留空=永久)"
              value={
                assignForm.expDate
                  ? (parseDate(assignForm.expDate) as any)
                  : null
              }
              onChange={(d: any) =>
                setAssignForm({
                  ...assignForm,
                  expDate: d
                    ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
                    : null,
                })
              }
            />
            <Input
              description="只算这条线路的用量,超了只停这条,车友其它线路照用;留空则只受账号总流量约束"
              label="这条线路的流量配额(GB,留空=不单独限)"
              type="number"
              value={assignForm.flowGb ?? ""}
              onChange={(e) =>
                setAssignForm({
                  ...assignForm,
                  flowGb: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setAssignOpen(false)}>
              关闭
            </Button>
            <Button
              color="primary"
              isLoading={assignLoading}
              onPress={handleNodeAssign}
            >
              分配
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 一键搭建整机协议:选机器,把所有支持的协议一键全建出来 */}
      <Modal isOpen={oneClickOpen} onClose={() => setOneClickOpen(false)}>
        <ModalContent>
          <ModalHeader>一键搭建整机协议</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              在选中的机器上一键建好全部协议:
              <b>
                VLESS-Reality、Trojan-Reality、VMess、Hysteria2、TUIC、AnyTLS
              </b>
              (端口、密钥、自签证书全自动;端口被占自动上移)。建好后就是一张机器卡,点「分配用户」出订阅即可。
            </div>
            <Select
              label="机器"
              placeholder="选一台机器(需在线)"
              selectedKeys={oneClickNodeId ? [String(oneClickNodeId)] : []}
              onSelectionChange={(k) =>
                setOneClickNodeId(Number(Array.from(k)[0]))
              }
            >
              {nodes.map((n) => (
                <SelectItem key={n.id}>{n.name}</SelectItem>
              ))}
            </Select>
            {/* Reality 借壳域名:给个常用列表,也允许自己输 */}
            <Autocomplete
              allowsCustomValue
              defaultItems={SNI_PRESETS}
              description="只影响 VLESS / Trojan 这两个 Reality 协议。可以直接输入别的域名;别用 www.microsoft.com(它上了后量子,握不上手)"
              inputValue={oneClickSni}
              label="伪装域名(Reality 借壳)"
              onInputChange={(v) => setOneClickSni(v)}
              onSelectionChange={(k) => {
                if (k) setOneClickSni(String(k));
              }}
            >
              {(item: any) => (
                <AutocompleteItem
                  key={item.value}
                  description={item.desc || undefined}
                >
                  {item.label}
                </AutocompleteItem>
              )}
            </Autocomplete>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setOneClickOpen(false)}>
              取消
            </Button>
            <Button
              color="secondary"
              isLoading={oneClickLoading}
              onPress={handleOneClick}
            >
              一键全建
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 单独加一个协议(补充用) */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalContent>
          <ModalHeader>单独加一个协议</ModalHeader>
          <ModalBody className="space-y-3">
            <Select
              description={
                isReality(createForm.protocol)
                  ? "无域名借 Reality(SNI 借壳),抗封锁强(推荐)"
                  : createForm.protocol === "vmess"
                    ? "VMess:TCP 无 TLS,无域名,兼容各种老客户端"
                    : ["hysteria2", "tuic", "anytls"].includes(
                          createForm.protocol,
                        )
                      ? '自签证书(无域名);客户端需勾选"允许不安全/insecure"。Hy2/TUIC 是 QUIC,快'
                      : "Shadowsocks-2022:无 TLS、任何客户端都通,简单稳"
              }
              label="协议"
              selectedKeys={[createForm.protocol]}
              onSelectionChange={(k) =>
                setCreateForm({
                  ...createForm,
                  protocol: String(Array.from(k)[0]),
                })
              }
            >
              <SelectItem key="vless">VLESS-Reality(无域名,推荐)</SelectItem>
              <SelectItem key="trojan">Trojan-Reality(无域名)</SelectItem>
              <SelectItem key="vmess">VMess(无域名,兼容老客户端)</SelectItem>
              <SelectItem key="hysteria2">
                Hysteria2(QUIC,快,自签证书)
              </SelectItem>
              <SelectItem key="tuic">TUIC(QUIC,自签证书)</SelectItem>
              <SelectItem key="anytls">AnyTLS(自签证书)</SelectItem>
            </Select>
            <Select
              label="机器"
              placeholder="选一台机器"
              selectedKeys={
                createForm.nodeId ? [String(createForm.nodeId)] : []
              }
              onSelectionChange={(k) =>
                setCreateForm({
                  ...createForm,
                  nodeId: Number(Array.from(k)[0]),
                })
              }
            >
              {nodes.map((n) => (
                <SelectItem key={n.id}>{n.name}</SelectItem>
              ))}
            </Select>
            {isReality(createForm.protocol) && (
              <>
                <Autocomplete
                  allowsCustomValue
                  defaultItems={SNI_PRESETS}
                  description="可以直接输入别的域名;别用 www.microsoft.com(它上了后量子,Reality 握不上手)"
                  inputValue={createForm.sni}
                  label="伪装域名(Reality 借壳)"
                  onInputChange={(v) =>
                    setCreateForm({ ...createForm, sni: v })
                  }
                  onSelectionChange={(k) => {
                    if (k) setCreateForm({ ...createForm, sni: String(k) });
                  }}
                >
                  {(item: any) => (
                    <AutocompleteItem
                      key={item.value}
                      description={item.desc || undefined}
                    >
                      {item.label}
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <Input
                  label="Reality 目标(留空=同 SNI)"
                  value={createForm.dest}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, dest: e.target.value })
                  }
                />
              </>
            )}
            <Input
              label="备注"
              value={createForm.remark}
              onChange={(e) =>
                setCreateForm({ ...createForm, remark: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={createLoading}
              onPress={handleCreate}
            >
              创建
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
