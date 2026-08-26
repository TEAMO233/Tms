import type {
  TransparentRelay,
  TransparentRelayBatchForm,
  TransparentRelayForm,
  UdpQuicRelayCreateForm,
  UdpQuicRelayResult,
} from "@/types";
import type { TransparentRelayStatusSummary } from "@/utils/transparent-relay-status";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { Alert } from "@heroui/alert";
import toast from "react-hot-toast";

import {
  createTransparentRelay,
  createTransparentRelayBatch,
  createTransparentRelaySubscription,
  createUdpQuicRelay,
  deleteTransparentRelay,
  getForwardList,
  getInboundList,
  getNodeList,
  getTransparentRelayList,
  getTunnelList,
  getTransparentRelayStatus,
  pauseTransparentRelay,
  resumeTransparentRelay,
  updateTransparentRelay,
} from "@/api";
import {
  buildTargetHostOptions,
  isUdpQuicProxyProtocol,
} from "@/utils/transparent-relay-options";
import { summarizeTransparentRelayStatus } from "@/utils/transparent-relay-status";
import { JwtUtil } from "@/utils/jwt";

const emptyForm: TransparentRelayForm = {
  name: "",
  inNodeId: null,
  entryPort: null,
  targetHost: "",
  targetPort: null,
  protocol: "tcp_udp",
};

const emptyBatchForm: TransparentRelayBatchForm = {
  inNodeId: null,
  targetHost: "",
};

const emptyUdpQuicForm: UdpQuicRelayCreateForm = {
  ingressNodeId: null,
  targetNodeId: null,
  protocols: ["hysteria2", "tuic"],
};

const RELAY_GRID_CLASS =
  "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.7fr)_minmax(0,2fr)]";

const protocolText = (protocol: string) => {
  if (protocol === "hysteria2") return "Hysteria2";
  if (protocol === "tuic") return "TUIC";
  if (protocol === "tcp") return "TCP";
  if (protocol === "udp") return "UDP";

  return "TCP+UDP";
};

const relayTypeChip = (relay: TransparentRelay) => {
  if (relay.relayType === "udp_quic") {
    return (
      <Chip color="warning" size="sm" variant="flat">
        HY2/TUIC 协议中转
      </Chip>
    );
  }

  return (
    <Chip color="primary" size="sm" variant="flat">
      L4 透明中转
    </Chip>
  );
};

const statusChip = (status: number) => {
  if (status === 1)
    return (
      <Chip color="success" size="sm">
        启用
      </Chip>
    );
  if (status === 0)
    return (
      <Chip color="default" size="sm">
        暂停
      </Chip>
    );

  return (
    <Chip color="danger" size="sm">
      应用失败
    </Chip>
  );
};

type NodeLike = {
  id: number;
  name?: string;
  ip?: string;
  serverIp?: string;
  country?: string;
};

const nodeOptionText = (node: NodeLike) =>
  `${node.name || `节点 ${node.id}`}${node.country ? ` (${node.country})` : ""}`;

type TunnelLike = {
  id: number;
  name?: string;
  inNodeId?: number;
  entryNodeId?: number;
};

type ForwardLike = {
  id: number;
  name?: string;
  tunnelId: number;
  inPort: number;
  remoteAddr?: string;
  status?: number;
  userId?: number;
};

type InboundLike = {
  id: number;
  nodeId: number;
  protocol?: string;
  listenPort?: number;
  remark?: string | null;
  tag?: string;
  status?: number;
};

type TargetPortOption = {
  key: string;
  value: number | null;
  label: string;
  protocolLabel?: string;
  protocol?: string;
  isUdpQuic?: boolean;
};

const buildTargetPortOptions = (
  targetNodeId: number | undefined,
  tunnels: TunnelLike[],
  forwards: ForwardLike[],
  inbounds: InboundLike[],
  currentUserId?: number | null,
): TargetPortOption[] => {
  if (!targetNodeId) return [];
  const tunnelIds = new Set(
    tunnels
      .filter(
        (tunnel) => (tunnel.inNodeId || tunnel.entryNodeId) === targetNodeId,
      )
      .map((tunnel) => tunnel.id),
  );
  const inboundByLocalPort = new Map<number, InboundLike>();

  inbounds
    .filter(
      (inbound) =>
        inbound.nodeId === targetNodeId &&
        !!inbound.listenPort &&
        inbound.status !== 0,
    )
    .forEach((inbound) => inboundByLocalPort.set(inbound.listenPort!, inbound));
  const seenPorts = new Set<number>();

  return forwards
    .filter(
      (forward) =>
        tunnelIds.has(forward.tunnelId) &&
        !!forward.inPort &&
        forward.status !== 0 &&
        (!currentUserId || forward.userId === currentUserId),
    )
    .sort((a, b) => a.inPort - b.inPort)
    .flatMap((forward) => {
      if (seenPorts.has(forward.inPort)) return [];
      seenPorts.add(forward.inPort);
      const inbound = findInboundForForward(forward, inboundByLocalPort);
      const protocolValue = inbound?.protocol;
      const protocol = protocolValue ? protoLabel(protocolValue) : "协议";
      const remark = inbound?.remark ? `${inbound.remark} · ` : "";
      const fallbackName = !inbound && forward.name ? `${forward.name} · ` : "";

      return [
        {
          key: String(forward.inPort),
          value: forward.inPort,
          label: `${protocol} · ${remark}${fallbackName}端口 ${forward.inPort}`,
          protocolLabel: protocol,
          protocol: protocolValue,
          isUdpQuic: isUdpQuicProxyProtocol(protocolValue),
        },
      ];
    });
};

const findInboundForForward = (
  forward: ForwardLike,
  inboundByLocalPort: Map<number, InboundLike>,
) => {
  const remote = forward.remoteAddr || "";

  for (const [port, inbound] of inboundByLocalPort.entries()) {
    if (remote.split(",").some((addr) => addr.trim().endsWith(`:${port}`))) {
      return inbound;
    }
  }

  return undefined;
};

const protoLabel = (protocol: string) =>
  (
    ({
      vless: "VLESS",
      trojan: "Trojan",
      vmess: "VMess",
      shadowsocks: "SS-2022",
      hysteria2: "Hysteria2",
      tuic: "TUIC",
      anytls: "AnyTLS",
    }) as Record<string, string>
  )[protocol] || protocol;

export default function TransparentRelayPage() {
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [relays, setRelays] = useState<TransparentRelay[]>([]);
  const [nodes, setNodes] = useState<NodeLike[]>([]);
  const [tunnels, setTunnels] = useState<TunnelLike[]>([]);
  const [forwards, setForwards] = useState<ForwardLike[]>([]);
  const [inbounds, setInbounds] = useState<InboundLike[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [udpQuicModalOpen, setUdpQuicModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<TransparentRelayForm>(emptyForm);
  const [batchForm, setBatchForm] =
    useState<TransparentRelayBatchForm>(emptyBatchForm);
  const [udpQuicForm, setUdpQuicForm] =
    useState<UdpQuicRelayCreateForm>(emptyUdpQuicForm);
  const [udpQuicResults, setUdpQuicResults] = useState<UdpQuicRelayResult[]>(
    [],
  );
  const [batchSubmitLoading, setBatchSubmitLoading] = useState(false);
  const [udpQuicSubmitLoading, setUdpQuicSubmitLoading] = useState(false);
  const [manualTargetHost, setManualTargetHost] = useState(false);
  const [manualTargetPort, setManualTargetPort] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSummary, setStatusSummary] =
    useState<TransparentRelayStatusSummary | null>(null);
  const [statusNodeName, setStatusNodeName] = useState("");
  const [statusLoading, setStatusLoading] = useState<number | null>(null);
  const [aggregateSubscriptionLoading, setAggregateSubscriptionLoading] =
    useState(false);
  const currentUserId = JwtUtil.getUserIdFromToken();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [relayRes, nodeRes, tunnelRes, forwardRes, inboundRes] =
        await Promise.all([
          getTransparentRelayList(),
          getNodeList(),
          getTunnelList(),
          getForwardList(),
          getInboundList().catch(() => ({ code: -1, data: [] }) as any),
        ]);

      if (relayRes.code === 0) {
        setRelays(relayRes.data || []);
      } else {
        toast.error(relayRes.msg || "获取透明中转列表失败");
      }
      if (nodeRes.code === 0) {
        setNodes(nodeRes.data || []);
      } else {
        toast.error(nodeRes.msg || "获取节点列表失败");
      }
      if (tunnelRes.code === 0) {
        setTunnels(tunnelRes.data || []);
      } else {
        toast.error(tunnelRes.msg || "获取隧道列表失败");
      }
      if (forwardRes.code === 0) {
        setForwards(forwardRes.data || []);
      } else {
        toast.error(forwardRes.msg || "获取目标端口列表失败");
      }
      if (inboundRes.code === 0) {
        setInbounds(inboundRes.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setIsEdit(false);
    setForm(emptyForm);
    setManualTargetHost(false);
    setManualTargetPort(false);
    setModalOpen(true);
  };

  const openBatchCreate = () => {
    setBatchForm(emptyBatchForm);
    setBatchModalOpen(true);
  };

  const openUdpQuicCreate = () => {
    setUdpQuicForm(emptyUdpQuicForm);
    setUdpQuicResults([]);
    setUdpQuicModalOpen(true);
  };

  const openEdit = (relay: TransparentRelay) => {
    setIsEdit(true);
    setManualTargetHost(false);
    setManualTargetPort(false);
    setForm({
      id: relay.id,
      name: relay.name,
      inNodeId: relay.inNodeId,
      entryPort: relay.entryPort,
      targetHost: relay.targetHost,
      targetPort: relay.targetPort,
      protocol: (relay.protocol === "tcp" ||
      relay.protocol === "udp" ||
      relay.protocol === "tcp_udp"
        ? relay.protocol
        : "tcp_udp") as TransparentRelayForm["protocol"],
    });
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.name.trim()) return "请填写规则名称";
    if (!form.inNodeId) return "请选择入口节点";
    if (form.entryPort && (form.entryPort < 1 || form.entryPort > 65535))
      return "入口端口必须在1-65535范围内";
    if (!form.targetHost.trim()) return "请填写目标IPv4地址";
    if (
      form.targetHost.trim() === "127.0.0.1" ||
      form.targetHost.trim().startsWith("127.") ||
      form.targetHost.trim() === "localhost"
    ) {
      return "目标不能填127.0.0.1/localhost,请填入口机可访问的主服务器IPv4";
    }
    if (!form.targetPort || form.targetPort < 1 || form.targetPort > 65535)
      return "目标端口必须在1-65535范围内";

    return "";
  };

  const handleSubmit = async () => {
    const err = validateForm();

    if (err) {
      toast.error(err);

      return;
    }
    setSubmitLoading(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        targetHost: form.targetHost.trim(),
      };
      const res = isEdit
        ? await updateTransparentRelay(payload)
        : await createTransparentRelay(payload);

      if (res.code === 0) {
        toast.success(isEdit ? "透明中转已更新" : "透明中转已创建");
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || "操作失败");
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const validateBatchForm = () => {
    if (!batchForm.inNodeId) return "请选择入口节点";
    if (!batchForm.targetHost.trim()) return "请选择目标 IPv4";

    return "";
  };

  const handleBatchSubmit = async () => {
    const err = validateBatchForm();

    if (err) {
      toast.error(err);

      return;
    }
    setBatchSubmitLoading(true);
    try {
      const res = await createTransparentRelayBatch({
        inNodeId: batchForm.inNodeId,
        targetHost: batchForm.targetHost.trim(),
      });

      if (res.code === 0) {
        const data = res.data;

        toast.success(
          `已生成 ${data?.createdCount || 0} 条，跳过 ${data?.skippedCount || 0} 条`,
        );
        setBatchModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || "批量创建失败");
      }
    } finally {
      setBatchSubmitLoading(false);
    }
  };

  const validateUdpQuicForm = () => {
    if (!udpQuicForm.ingressNodeId) return "请选择入口节点";
    if (!udpQuicForm.targetNodeId) return "请选择目标节点";
    if (udpQuicForm.ingressNodeId === udpQuicForm.targetNodeId)
      return "入口节点和目标节点不能相同";
    if (udpQuicForm.protocols.length === 0) return "请选择 Hysteria2 或 TUIC";

    return "";
  };

  const toggleUdpQuicProtocol = (
    protocol: "hysteria2" | "tuic",
    enabled: boolean,
  ) => {
    const protocols = new Set<"hysteria2" | "tuic">(udpQuicForm.protocols);

    if (enabled) {
      protocols.add(protocol);
    } else {
      protocols.delete(protocol);
    }
    setUdpQuicForm({ ...udpQuicForm, protocols: Array.from(protocols) });
  };

  const handleUdpQuicSubmit = async () => {
    const err = validateUdpQuicForm();

    if (err) {
      toast.error(err);

      return;
    }
    setUdpQuicSubmitLoading(true);
    try {
      const res = await createUdpQuicRelay(udpQuicForm);

      if (res.code === 0) {
        const data = res.data || [];
        const okCount = data.filter((item) => !item.skippedReason).length;

        setUdpQuicResults(data);
        toast.success(`HY2/TUIC 协议中转完成 ${okCount} 条`);
        loadData();
      } else {
        toast.error(res.msg || "创建 HY2/TUIC 协议中转失败");
      }
    } finally {
      setUdpQuicSubmitLoading(false);
    }
  };

  const handleDelete = async (relay: TransparentRelay) => {
    if (!window.confirm(`确定删除透明中转「${relay.name}」吗?`)) return;
    const res = await deleteTransparentRelay(relay.id);

    if (res.code === 0) {
      toast.success("已删除");
      loadData();
    } else {
      toast.error(res.msg || "删除失败");
    }
  };

  const handleToggle = async (relay: TransparentRelay) => {
    const res =
      relay.status === 1
        ? await pauseTransparentRelay(relay.id)
        : await resumeTransparentRelay(relay.id);

    if (res.code === 0) {
      toast.success(relay.status === 1 ? "已暂停" : "已恢复");
      loadData();
    } else {
      toast.error(res.msg || "操作失败");
    }
  };

  const handleStatus = async (nodeId: number) => {
    setStatusLoading(nodeId);
    try {
      const res = await getTransparentRelayStatus(nodeId);

      if (res.code === 0) {
        const nodeName =
          nodes.find((node) => node.id === nodeId)?.name || `节点 ${nodeId}`;
        const nodeRelays = relays.filter((relay) => relay.inNodeId === nodeId);

        setStatusNodeName(nodeName);
        setStatusSummary(
          summarizeTransparentRelayStatus(res.data || {}, nodeRelays),
        );
        setStatusModalOpen(true);
      } else {
        toast.error(res.msg || "读取节点状态失败");
      }
    } finally {
      setStatusLoading(null);
    }
  };

  const handleCopyAggregateSubscription = async () => {
    setAggregateSubscriptionLoading(true);
    try {
      const res = await createTransparentRelaySubscription();

      if (res.code !== 0 || !res.data?.subToken) {
        toast.error(res.msg || "生成透明中转聚合订阅失败");

        return;
      }
      const url = `${window.location.origin}/api/v1/open_api/transparent_relay_sub?token=${encodeURIComponent(res.data.subToken)}`;

      await copyToClipboard(url);
      toast.success(
        `透明中转聚合订阅已复制：可用 ${res.data.availableCount || 0} 条，跳过 ${res.data.skippedCount || 0} 条`,
      );
    } finally {
      setAggregateSubscriptionLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);

      return;
    }
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const targetHostOptions = buildTargetHostOptions(nodes);
  const targetHostSelectOptions = [
    ...targetHostOptions,
    {
      key: "__manual__",
      value: "__manual__",
      nodeId: 0,
      label: "手动填写 / WG IPv4",
    },
  ];
  const selectedBatchTargetHostOption = targetHostOptions.find(
    (option) => option.value === batchForm.targetHost,
  );
  const batchTargetPortOptions = buildTargetPortOptions(
    selectedBatchTargetHostOption?.nodeId,
    tunnels,
    forwards,
    inbounds,
    currentUserId,
  );
  const batchL4TargetPortOptions = batchTargetPortOptions.filter(
    (option) => !option.isUdpQuic,
  );
  const batchSkippedQuicOptions = batchTargetPortOptions.filter(
    (option) => option.isUdpQuic,
  );
  const batchTargetHostSelectedKeys =
    batchForm.targetHost && selectedBatchTargetHostOption
      ? [selectedBatchTargetHostOption.key]
      : [];
  const selectedTargetHostOption = targetHostOptions.find(
    (option) => option.value === form.targetHost,
  );
  const targetHostKnown = !!selectedTargetHostOption;
  const targetPortOptions = buildTargetPortOptions(
    selectedTargetHostOption?.nodeId,
    tunnels,
    forwards,
    inbounds,
    currentUserId,
  );
  const targetPortSelectOptions = [
    ...targetPortOptions,
    { key: "__manual__", value: null, label: "手动填写目标端口" },
  ];
  const targetPortKnown = targetPortOptions.some(
    (option) => option.value === form.targetPort,
  );
  const showManualTargetHost =
    manualTargetHost || (!!form.targetHost && !targetHostKnown);
  const showManualTargetPort =
    manualTargetPort || (!!form.targetPort && !targetPortKnown);
  const targetHostSelectedKeys = form.targetHost
    ? [targetHostKnown ? selectedTargetHostOption!.key : "__manual__"]
    : manualTargetHost
      ? ["__manual__"]
      : [];
  const targetPortSelectedKeys = form.targetPort
    ? [targetPortKnown ? String(form.targetPort) : "__manual__"]
    : manualTargetPort
      ? ["__manual__"]
      : [];

  const handleBatchTargetHostSelection = (keys: any) => {
    const selected = String(Array.from(keys)[0] || "");

    if (!selected) return;
    const option = targetHostOptions.find((item) => item.key === selected);

    if (!option) return;
    setBatchForm({ ...batchForm, targetHost: option.value });
  };

  const handleTargetHostSelection = (keys: any) => {
    const selected = String(Array.from(keys)[0] || "");

    if (!selected) return;
    if (selected === "__manual__") {
      setManualTargetHost(true);
      setManualTargetPort(true);
      if (targetHostKnown) {
        setForm({ ...form, targetHost: "", targetPort: null });
      }

      return;
    }
    const option = targetHostOptions.find((item) => item.key === selected);

    if (!option) return;
    const portOptions = buildTargetPortOptions(
      option.nodeId,
      tunnels,
      forwards,
      inbounds,
      currentUserId,
    );

    setManualTargetHost(false);
    setManualTargetPort(false);
    setForm({
      ...form,
      targetHost: option.value,
      targetPort: portOptions[0]?.value || null,
    });
  };

  const handleTargetPortSelection = (keys: any) => {
    const selected = String(Array.from(keys)[0] || "");

    if (!selected) return;
    if (selected === "__manual__") {
      setManualTargetPort(true);
      if (targetPortKnown) {
        setForm({ ...form, targetPort: null });
      }

      return;
    }
    setManualTargetPort(false);
    setForm({ ...form, targetPort: Number(selected) });
  };

  const relayDisplayName = (relay: TransparentRelay) => {
    const targetHostOption = targetHostOptions.find(
      (option) => option.value === relay.targetHost,
    );

    if (!targetHostOption) return relay.name;
    const targetNode = nodes.find(
      (node) => node.id === targetHostOption.nodeId,
    );
    const targetPortOption = buildTargetPortOptions(
      targetHostOption.nodeId,
      tunnels,
      forwards,
      inbounds,
      currentUserId,
    ).find((option) => option.value === relay.targetPort);
    const protocol = targetPortOption?.protocolLabel;

    if (!targetNode || !protocol) return relay.name;
    const ingressName = relay.inNodeName || `节点 ${relay.inNodeId}`;
    const targetName = targetNode.name || `节点 ${targetNode.id}`;

    return `${ingressName} -> ${targetName} ${protocol} ${relay.targetPort}`;
  };

  const l4Relays = relays.filter((relay) => relay.relayType !== "udp_quic");
  const udpQuicRelays = relays.filter(
    (relay) => relay.relayType === "udp_quic",
  );
  const failedRelayCount = relays.filter((relay) => relay.status < 0).length;
  const pausedRelayCount = relays.filter((relay) => relay.status === 0).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">透明中转</h1>
            <Chip color="primary" size="sm" variant="flat">
              运维信号板
            </Chip>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-default-500">
            线路机模式:客户端连入口节点,入口机用 nftables DNAT+SNAT
            转到主服务器端口,真实出口仍是主服务器。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button size="sm" variant="flat" onPress={loadData}>
            刷新
          </Button>
          <Button
            color="success"
            isLoading={aggregateSubscriptionLoading}
            size="sm"
            variant="flat"
            onPress={handleCopyAggregateSubscription}
          >
            复制聚合订阅
          </Button>
          <Button
            color="secondary"
            size="sm"
            variant="flat"
            onPress={openBatchCreate}
          >
            一键添加所有
          </Button>
          <Button
            color="warning"
            size="sm"
            variant="flat"
            onPress={openUdpQuicCreate}
          >
            创建 HY2/TUIC 协议中转
          </Button>
          <Button color="primary" size="sm" onPress={openCreate}>
            新增透明中转
          </Button>
        </div>
      </div>

      <Alert className="px-4 py-2 text-sm" color="warning" variant="flat">
        透明中转页会统一展示 L4 透明中转和 HY2/TUIC
        协议中转；顶部“复制聚合订阅”会生成本页所有可用线路的一条独立订阅链接，和「我的订阅」互不影响。
      </Alert>

      <Card className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <CardBody className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 sm:p-3">
          <div className="min-w-0 border-l-2 border-primary px-3 py-2">
            <div className="text-xs text-default-500">透明中转总数</div>
            <div className="mt-1 text-2xl font-semibold leading-none">
              {relays.length}
            </div>
          </div>
          <div className="min-w-0 border-l-2 border-primary px-3 py-2">
            <div className="text-xs text-default-500">L4 透明中转</div>
            <div className="mt-1 text-2xl font-semibold leading-none text-primary">
              {l4Relays.length}
            </div>
          </div>
          <div className="min-w-0 border-l-2 border-warning px-3 py-2">
            <div className="text-xs text-default-500">HY2/TUIC 协议中转</div>
            <div className="mt-1 text-2xl font-semibold leading-none text-warning">
              {udpQuicRelays.length}
            </div>
          </div>
          <div className="min-w-0 border-l-2 border-danger px-3 py-2">
            <div className="text-xs text-default-500">异常 / 已暂停</div>
            <div className="mt-1 text-2xl font-semibold leading-none">
              <span className="text-danger">{failedRelayCount}</span>
              <span className="text-default-400"> / </span>
              <span>{pausedRelayCount}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {relays.length > 0 && (
        <>
          <Card className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <CardHeader className="flex-col items-start gap-1 border-b border-default-200/70 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">L4 透明中转</h2>
                  <Chip color="primary" size="sm" variant="flat">
                    {l4Relays.length} 条
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-default-500">
                  基于 L4（TCP/UDP）端口映射的透明中转。
                </p>
              </div>
              <span className="text-xs text-default-500">
                入口 → 目标 → 状态 → 操作
              </span>
            </CardHeader>
            <CardBody className="p-0">
              {l4Relays.length > 0 ? (
                <>
                  <div
                    className={`hidden gap-4 border-b border-default-200/70 bg-default-50/50 px-4 py-3 text-xs font-medium text-default-500 dark:bg-white/[0.03] xl:grid ${RELAY_GRID_CLASS}`}
                  >
                    <div>名称</div>
                    <div>来源节点（入口）</div>
                    <div>目标节点（真实出口）</div>
                    <div>协议 / 类型</div>
                    <div>状态</div>
                    <div className="text-right">操作</div>
                  </div>
                  <div className="divide-y divide-default-200/60">
                    {l4Relays.map((relay) => {
                      const displayName = relayDisplayName(relay);
                      const entryAddress = `${relay.inNodeServerIp || relay.inNodeIp || relay.inNodeName || `节点 ${relay.inNodeId}`}:${relay.entryPort}`;
                      const targetAddress = `${relay.targetHost}:${relay.targetPort}`;

                      return (
                        <div
                          key={`${relay.relayType || "l4"}-${relay.id}`}
                          className={`grid min-w-0 gap-2 px-4 py-3 xl:items-center xl:gap-3 ${RELAY_GRID_CLASS}`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-default-500 xl:hidden">
                              名称
                            </div>
                            <div
                              className="break-words font-semibold"
                              title={displayName}
                            >
                              {displayName}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm">
                            <div className="text-xs text-default-500 xl:hidden">
                              来源节点（入口）
                            </div>
                            <div className="break-words">
                              {relay.inNodeName || `节点 ${relay.inNodeId}`}
                            </div>
                            <div
                              className="mt-1 break-all font-mono text-xs text-default-500"
                              title={entryAddress}
                            >
                              {entryAddress}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm">
                            <div className="text-xs text-default-500 xl:hidden">
                              目标节点（真实出口）
                            </div>
                            <div
                              className="break-all font-mono"
                              title={targetAddress}
                            >
                              {targetAddress}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-default-500 xl:hidden">
                              协议 / 类型
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {relayTypeChip(relay)}
                              <Chip size="sm" variant="flat">
                                {protocolText(relay.protocol)}
                              </Chip>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2 xl:block">
                            <div className="text-xs text-default-500 xl:hidden">
                              状态
                            </div>
                            {statusChip(relay.status)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-default-500 xl:hidden">
                              操作
                            </div>
                            <div className="flex flex-wrap gap-2 xl:justify-end">
                              <Button
                                size="sm"
                                variant="flat"
                                onPress={() => openEdit(relay)}
                              >
                                编辑
                              </Button>
                              <Button
                                color={
                                  relay.status === 1 ? "warning" : "success"
                                }
                                size="sm"
                                variant="flat"
                                onPress={() => handleToggle(relay)}
                              >
                                {relay.status === 1 ? "暂停" : "恢复"}
                              </Button>
                              <Button
                                isLoading={statusLoading === relay.inNodeId}
                                size="sm"
                                variant="flat"
                                onPress={() => handleStatus(relay.inNodeId)}
                              >
                                节点状态
                              </Button>
                              <Button
                                color="danger"
                                size="sm"
                                variant="flat"
                                onPress={() => handleDelete(relay)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                          {relay.lastError && (
                            <div className="col-span-full min-w-0 break-all text-sm text-danger xl:-mt-2">
                              最近错误: {relay.lastError}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="px-4 py-8 text-sm text-default-500">
                  暂无 L4 透明中转规则。
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <CardHeader className="flex-col items-start gap-1 border-b border-default-200/70 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">HY2/TUIC 协议中转</h2>
                  <Chip color="warning" size="sm" variant="flat">
                    {udpQuicRelays.length} 条
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-default-500">
                  基于 HY2/TUIC 协议的专用中转通道。
                </p>
              </div>
              <span className="text-xs text-default-500">
                入口 → 落地 → 状态 → 指引
              </span>
            </CardHeader>
            <CardBody className="p-0">
              {udpQuicRelays.length > 0 ? (
                <>
                  <div
                    className={`hidden gap-4 border-b border-default-200/70 bg-default-50/50 px-4 py-3 text-xs font-medium text-default-500 dark:bg-white/[0.03] xl:grid ${RELAY_GRID_CLASS}`}
                  >
                    <div>名称</div>
                    <div>来源节点（入口）</div>
                    <div>目标节点（真实出口）</div>
                    <div>协议 / 类型</div>
                    <div>状态</div>
                    <div className="text-right">当前指引</div>
                  </div>
                  <div className="divide-y divide-default-200/60">
                    {udpQuicRelays.map((relay) => {
                      const displayName = relayDisplayName(relay);
                      const entryAddress = `${relay.inNodeServerIp || relay.inNodeIp || relay.inNodeName || `节点 ${relay.inNodeId}`}:${relay.entryPort}`;
                      const landingName =
                        relay.landingName || relay.targetName || "协议落地";

                      return (
                        <div
                          key={`${relay.relayType || "udp_quic"}-${relay.id}`}
                          className={`grid min-w-0 gap-2 px-4 py-3 xl:items-center xl:gap-3 ${RELAY_GRID_CLASS}`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-default-500 xl:hidden">
                              名称
                            </div>
                            <div
                              className="break-words font-semibold"
                              title={displayName}
                            >
                              {displayName}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm">
                            <div className="text-xs text-default-500 xl:hidden">
                              来源节点（入口）
                            </div>
                            <div className="break-words">
                              {relay.inNodeName || `节点 ${relay.inNodeId}`}
                            </div>
                            <div
                              className="mt-1 break-all font-mono text-xs text-default-500"
                              title={entryAddress}
                            >
                              {entryAddress}
                            </div>
                          </div>
                          <div className="min-w-0 text-sm">
                            <div className="text-xs text-default-500 xl:hidden">
                              目标节点（真实出口）
                            </div>
                            <div className="break-words" title={landingName}>
                              {landingName}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-default-500 xl:hidden">
                              协议 / 类型
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {relayTypeChip(relay)}
                              <Chip size="sm" variant="flat">
                                {protocolText(relay.protocol)}
                              </Chip>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2 xl:block">
                            <div className="text-xs text-default-500 xl:hidden">
                              状态
                            </div>
                            {statusChip(relay.status)}
                          </div>
                          <div className="min-w-0 text-sm text-default-500">
                            <div className="text-xs text-default-500 xl:hidden">
                              当前指引
                            </div>
                            <div className="break-words">
                              协议中转的启停/清理请到「中转」或「协议管理」页面处理；订阅请使用本页顶部的聚合订阅。
                            </div>
                          </div>
                          {relay.lastError && (
                            <div className="col-span-full min-w-0 break-all text-sm text-danger xl:-mt-2">
                              最近错误: {relay.lastError}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="px-4 py-8 text-sm text-default-500">
                  暂无 HY2/TUIC 协议中转规则。
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {relays.length === 0 && (
        <Card>
          <CardBody className="text-center text-default-500 py-12">
            还没有透明中转规则。可以先选日本 VMISS 作为入口,目标填主服务器 IPv4
            和节点端口。
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={batchModalOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setBatchModalOpen}
      >
        <ModalContent>
          <ModalHeader>一键添加所有透明中转</ModalHeader>
          <ModalBody className="space-y-3">
            <Alert color="primary" variant="flat">
              选择入口节点和目标 IPv4 后，只会把当前登录用户在该目标机器下适合
              L4 的 TCP 类端口生成透明中转；Hysteria2/TUIC 属于
              UDP/QUIC，默认跳过，建议改用“HY2/TUIC 协议中转”。
            </Alert>
            <Select
              label="入口节点 / 线路机"
              placeholder="选择要作为线路入口的节点"
              selectedKeys={
                batchForm.inNodeId ? [String(batchForm.inNodeId)] : []
              }
              onSelectionChange={(k) =>
                setBatchForm({
                  ...batchForm,
                  inNodeId: Number(Array.from(k)[0]),
                })
              }
            >
              {nodes.map((n) => (
                <SelectItem key={n.id} textValue={nodeOptionText(n)}>
                  {nodeOptionText(n)}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="目标 IPv4"
              placeholder="选择要批量中转到的目标机器"
              selectedKeys={batchTargetHostSelectedKeys}
              onSelectionChange={handleBatchTargetHostSelection}
            >
              {targetHostOptions.map((option) => (
                <SelectItem key={option.key} textValue={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
            <div className="rounded-lg bg-default-100 p-3 space-y-2">
              <div className="text-sm font-medium">
                当前用户将生成的目标端口
              </div>
              {batchL4TargetPortOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {batchL4TargetPortOptions.map((option) => (
                    <Chip key={option.key} size="sm" variant="flat">
                      {option.label}
                    </Chip>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-default-500">
                  请选择目标 IPv4；若这里为空，说明目标机器没有适合 L4
                  批量生成的已启用端口。
                </div>
              )}
              {batchSkippedQuicOptions.length > 0 && (
                <div className="rounded-lg bg-warning/10 p-3 space-y-2">
                  <div className="text-sm font-medium text-warning-700">
                    已跳过 HY2/TUIC，建议走协议中转
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {batchSkippedQuicOptions.map((option) => (
                      <Chip
                        key={`skip-${option.key}`}
                        color="warning"
                        size="sm"
                        variant="flat"
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setBatchModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              isDisabled={batchL4TargetPortOptions.length === 0}
              isLoading={batchSubmitLoading}
              onPress={handleBatchSubmit}
            >
              一键生成 {batchL4TargetPortOptions.length || ""}
              {batchL4TargetPortOptions.length > 0 ? " 条" : ""}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={udpQuicModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onOpenChange={setUdpQuicModalOpen}
      >
        <ModalContent>
          <ModalHeader>创建 HY2/TUIC 协议中转</ModalHeader>
          <ModalBody className="space-y-3">
            <Alert color="warning" variant="flat">
              这条路径会新建“入口节点协议入站 → 目标节点 HY2/TUIC
              出站”的协议中转；不会自动删除或暂停现有 L4 HY2/TUIC
              透明中转，测试成功后再手动处理旧规则。
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="入口节点 / 线路机"
                placeholder="例如 vmiss日本"
                selectedKeys={
                  udpQuicForm.ingressNodeId
                    ? [String(udpQuicForm.ingressNodeId)]
                    : []
                }
                onSelectionChange={(k) =>
                  setUdpQuicForm({
                    ...udpQuicForm,
                    ingressNodeId: Number(Array.from(k)[0]),
                  })
                }
              >
                {nodes.map((n) => (
                  <SelectItem key={n.id} textValue={nodeOptionText(n)}>
                    {nodeOptionText(n)}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="目标节点 / 出口机"
                placeholder="例如 本机 SG"
                selectedKeys={
                  udpQuicForm.targetNodeId
                    ? [String(udpQuicForm.targetNodeId)]
                    : []
                }
                onSelectionChange={(k) =>
                  setUdpQuicForm({
                    ...udpQuicForm,
                    targetNodeId: Number(Array.from(k)[0]),
                  })
                }
              >
                {nodes.map((n) => (
                  <SelectItem key={n.id} textValue={nodeOptionText(n)}>
                    {nodeOptionText(n)}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="rounded-lg bg-default-100 p-3 space-y-3">
              <div className="text-sm font-medium">协议</div>
              <div className="flex flex-wrap gap-4">
                <Switch
                  isSelected={udpQuicForm.protocols.includes("hysteria2")}
                  onValueChange={(checked) =>
                    toggleUdpQuicProtocol("hysteria2", checked)
                  }
                >
                  Hysteria2
                </Switch>
                <Switch
                  isSelected={udpQuicForm.protocols.includes("tuic")}
                  onValueChange={(checked) =>
                    toggleUdpQuicProtocol("tuic", checked)
                  }
                >
                  TUIC
                </Switch>
              </div>
            </div>
            {udpQuicForm.ingressNodeId && udpQuicForm.targetNodeId && (
              <div className="rounded-lg bg-primary/10 p-3 space-y-2 text-sm">
                <div className="font-medium">将创建</div>
                {udpQuicForm.protocols.map((protocol) => {
                  const ingressName =
                    nodes.find((node) => node.id === udpQuicForm.ingressNodeId)
                      ?.name || "入口节点";
                  const targetName =
                    nodes.find((node) => node.id === udpQuicForm.targetNodeId)
                      ?.name || "目标节点";

                  return (
                    <div key={protocol}>
                      - {ingressName} -&gt; {targetName} {protoLabel(protocol)}{" "}
                      协议中转
                    </div>
                  );
                })}
                <div className="text-default-500">
                  目标凭证默认使用当前管理员；如果目标节点还没给当前管理员分配该协议，会自动补一条目标凭证。
                </div>
              </div>
            )}
            {udpQuicResults.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium">创建结果</div>
                {udpQuicResults.map((item) => (
                  <div
                    key={item.protocol}
                    className="rounded-lg border border-default-200 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Chip
                        color={item.skippedReason ? "warning" : "success"}
                        size="sm"
                        variant="flat"
                      >
                        {protoLabel(item.protocol)}
                      </Chip>
                      <span className="text-sm text-default-500">
                        {item.entryPort
                          ? `入口端口 ${item.entryPort}`
                          : "未生成入口端口"}
                      </span>
                    </div>
                    {item.skippedReason ? (
                      <div className="text-sm text-warning-700 break-all">
                        {item.skippedReason}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span>
                          landing #{item.landingId} · inbound #{item.inboundId}
                        </span>
                        {item.link && (
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => copyToClipboard(item.link || "")}
                          >
                            复制链接
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setUdpQuicModalOpen(false)}>
              关闭
            </Button>
            <Button
              color="warning"
              isLoading={udpQuicSubmitLoading}
              onPress={handleUdpQuicSubmit}
            >
              创建协议中转
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={modalOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setModalOpen}
      >
        <ModalContent>
          <ModalHeader>{isEdit ? "编辑透明中转" : "新增透明中转"}</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="规则名称"
              placeholder="例如 JP -> SG HY2"
              value={form.name}
              onValueChange={(v) => setForm({ ...form, name: v })}
            />
            <Select
              label="入口节点 / 线路机"
              placeholder="选择 VMISS 日本等入口机"
              selectedKeys={form.inNodeId ? [String(form.inNodeId)] : []}
              onSelectionChange={(k) =>
                setForm({ ...form, inNodeId: Number(Array.from(k)[0]) })
              }
            >
              {nodes.map((n) => (
                <SelectItem key={n.id} textValue={nodeOptionText(n)}>
                  {nodeOptionText(n)}
                </SelectItem>
              ))}
            </Select>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                description="不填时会从入口节点端口范围里随机选择一个未被 TMS 转发/透明中转占用的端口。"
                label="入口端口"
                placeholder="留空自动分配"
                type="number"
                value={form.entryPort ? String(form.entryPort) : ""}
                onValueChange={(v) =>
                  setForm({ ...form, entryPort: v ? Number(v) : null })
                }
              />
              <Select
                label="协议"
                selectedKeys={[form.protocol]}
                onSelectionChange={(k) =>
                  setForm({
                    ...form,
                    protocol: String(
                      Array.from(k)[0],
                    ) as TransparentRelayForm["protocol"],
                  })
                }
              >
                <SelectItem key="tcp_udp">TCP+UDP</SelectItem>
                <SelectItem key="tcp">TCP</SelectItem>
                <SelectItem key="udp">UDP</SelectItem>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="目标 IPv4"
                placeholder="选择主服务器节点 IP"
                selectedKeys={targetHostSelectedKeys}
                onSelectionChange={handleTargetHostSelection}
              >
                {targetHostSelectOptions.map((option) => (
                  <SelectItem key={option.key} textValue={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="目标端口"
                placeholder={
                  targetPortOptions.length > 0
                    ? "选择目标节点现有端口"
                    : "先选择目标 IPv4"
                }
                selectedKeys={targetPortSelectedKeys}
                onSelectionChange={handleTargetPortSelection}
              >
                {targetPortSelectOptions.map((option) => (
                  <SelectItem key={option.key} textValue={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            {showManualTargetPort && (
              <Input
                description="下拉列表来自所选目标节点上的现有 TMS 入口端口，并优先用协议名称标记；没有登记的端口仍可手动填写。"
                label="手动目标端口"
                placeholder="20000"
                type="number"
                value={form.targetPort ? String(form.targetPort) : ""}
                onValueChange={(v) =>
                  setForm({ ...form, targetPort: v ? Number(v) : null })
                }
              />
            )}
            {showManualTargetHost && (
              <Input
                description="下拉列表来自节点的服务器IP/入口IP；WireGuard 或未登记地址仍可手动填写。"
                label="手动目标 IPv4"
                placeholder="主服务器公网IP或WG IPv4"
                value={form.targetHost}
                onValueChange={(v) => setForm({ ...form, targetHost: v })}
              />
            )}
            <Alert color="primary" variant="flat">
              这不是新代理节点,只是四层入口。客户端认证参数仍用目标主服务器节点;入口机只负责把
              TCP/UDP 包转过去并做 masquerade。
            </Alert>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={submitLoading}
              onPress={handleSubmit}
            >
              {isEdit ? "保存" : "创建"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={statusModalOpen}
        scrollBehavior="inside"
        size="4xl"
        onOpenChange={setStatusModalOpen}
      >
        <ModalContent>
          <ModalHeader>
            节点透明中转状态 · {statusNodeName || "入口节点"}
          </ModalHeader>
          <ModalBody>
            {statusSummary && (
              <div className="space-y-4">
                <Alert
                  color={
                    statusSummary.level === "success"
                      ? "success"
                      : statusSummary.level === "warning"
                        ? "warning"
                        : "danger"
                  }
                  variant="flat"
                >
                  <div className="space-y-1">
                    <div className="font-semibold">{statusSummary.title}</div>
                    <div className="text-sm">{statusSummary.description}</div>
                  </div>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-default-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">系统转发</div>
                      <Chip
                        color={
                          statusSummary.ipForward.ok ? "success" : "danger"
                        }
                        size="sm"
                        variant="flat"
                      >
                        {statusSummary.ipForward.label}
                      </Chip>
                    </div>
                    <div className="text-sm text-default-500">
                      {statusSummary.ipForward.description}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-default-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">规则下发</div>
                      <Chip
                        color={statusSummary.table.ok ? "success" : "danger"}
                        size="sm"
                        variant="flat"
                      >
                        {statusSummary.table.label}
                      </Chip>
                    </div>
                    <div className="text-sm text-default-500 break-all">
                      {statusSummary.table.description}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-primary/10 space-y-1">
                  <div className="text-sm text-default-500">流量路径</div>
                  <div className="font-mono text-sm break-all">
                    {statusSummary.pathText}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">端口转发明细</div>
                  {statusSummary.routes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {statusSummary.routes.map((route) => (
                        <div
                          key={`${route.protocol}-${route.entryPort}-${route.target}`}
                          className="p-3 rounded-lg border border-default-200 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Chip
                                color={route.active ? "success" : "default"}
                                size="sm"
                                variant="flat"
                              >
                                {route.protocolLabel}
                              </Chip>
                              <span className="text-sm font-medium">
                                {route.relayName || "未匹配到面板规则名"}
                              </span>
                            </div>
                            <Chip
                              color={route.active ? "success" : "default"}
                              size="sm"
                              variant="flat"
                            >
                              {route.active ? "有流量" : "暂无流量"}
                            </Chip>
                          </div>
                          <div className="text-sm">
                            <span className="text-default-500">入口端口 </span>
                            <span className="font-mono">{route.entryPort}</span>
                            <span className="text-default-500"> 转到 </span>
                            <span className="font-mono break-all">
                              {route.target}
                            </span>
                          </div>
                          <div className="text-xs text-default-500">
                            累计流量: {route.flowText}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-default-100 text-sm text-default-500">
                      没有解析到端口规则。若这条透明中转已暂停，这是正常的；如果应当启用，请重新下发或检查节点日志。
                    </div>
                  )}
                </div>

                <details className="rounded-lg bg-default-100 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    高级：查看原始 nftables 输出
                  </summary>
                  <pre className="mt-3 text-xs whitespace-pre-wrap break-all rounded-lg bg-default-50 p-3">
                    {statusSummary.rawRuleset || "无原始输出"}
                  </pre>
                </details>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setStatusModalOpen(false)}>关闭</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
