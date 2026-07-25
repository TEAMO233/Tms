import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import toast from "react-hot-toast";
import {
  getInboundList,
  oneClickRelay,
  testLanding,
  deleteInboundsByNode,
  assignAllToUser,
  getNodeList,
  getAllUsers,
  getSpeedLimitList,
  getLandingList,
} from "@/api";

/**
 * 中转(前置机协议 + 落地出口)· 机器卡模式。
 * 搭中转时当场填落地(粘贴分享链接/住宅socks)→ 经前置机测试通 → 保存搭建。
 * 车友连的还是前置机的订阅,只是出口 IP 在落地那台。
 */
export default function RelayPage() {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [speedRules, setSpeedRules] = useState<any[]>([]);
  const [landings, setLandings] = useState<any[]>([]);

  const [buildOpen, setBuildOpen] = useState(false);
  const [buildForm, setBuildForm] = useState<any>({ nodeId: null, name: "", link: "" });
  const [buildLoading, setBuildLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null); // {ok, exitIp, latencyMs, skipped, msg}

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ nodeId: null, nodeName: "", protocolCount: 0, userId: null, speedId: null, expDays: null, flowGb: null });
  const [assignLoading, setAssignLoading] = useState(false);

  const loadAll = async () => {
    try {
      const [ib, nd, us, sp, ld] = await Promise.all([
        getInboundList(),
        getNodeList(),
        getAllUsers(),
        getSpeedLimitList(),
        getLandingList(),
      ]);
      if (ib.code === 0) setInbounds(ib.data || []);
      if (nd.code === 0) setNodes(nd.data || []);
      if (us.code === 0) {
        const d: any = us.data;
        setUsers(Array.isArray(d) ? d : (d && d.records ? d.records : []));
      }
      if (sp.code === 0) setSpeedRules(sp.data || []);
      if (ld.code === 0) setLandings(ld.data || []);
    } catch (e) {
      toast.error("加载失败");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const protoLabel = (p: string) =>
    (({ vless: "VLESS-Reality", trojan: "Trojan-Reality", vmess: "VMess", shadowsocks: "Shadowsocks-2022", hysteria2: "Hysteria2", tuic: "TUIC", anytls: "AnyTLS" } as any)[p] || p);
  const landingById = (id: any) => landings.find((l) => l.id === id);

  const handleTest = async () => {
    if (!buildForm.nodeId) return toast.error("先选前置机(要经它测落地)");
    if (!buildForm.link) return toast.error("先粘贴落地链接");
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await testLanding(buildForm.nodeId, buildForm.link);
      if (res.code === 0) {
        setTestResult(res.data);
        if (res.data?.skipped) toast.success(res.data?.msg || "格式已校验");
        else if (res.data?.ok) toast.success(`通了,出口 IP ${res.data?.exitIp}`);
      } else {
        setTestResult({ ok: false, msg: res.msg });
        toast.error(res.msg || "测试失败");
      }
    } catch (e) {
      toast.error("测试失败");
    }
    setTestLoading(false);
  };

  const handleBuild = async () => {
    if (!buildForm.nodeId) return toast.error("请选择前置机");
    if (!buildForm.link) return toast.error("请粘贴落地链接");
    setBuildLoading(true);
    try {
      const res = await oneClickRelay(buildForm.nodeId, buildForm.link, buildForm.name);
      if (res.code === 0) {
        toast.success("一键搭中转完成:整机协议已建好,出口走落地");
        setBuildOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "搭建失败");
      }
    } catch (e) {
      toast.error("搭建失败");
    }
    setBuildLoading(false);
  };

  const openNodeAssign = (n: any, count: number) => {
    setAssignForm({ nodeId: n.id, nodeName: n.name, protocolCount: count, userId: null, speedId: null, expDays: null, flowGb: null });
    setAssignOpen(true);
  };

  const handleNodeAssign = async () => {
    if (!assignForm.userId) return toast.error("请选择车友");
    setAssignLoading(true);
    try {
      const payload: any = { userId: assignForm.userId, nodeId: assignForm.nodeId };
      if (assignForm.speedId) payload.speedId = assignForm.speedId;
      if (assignForm.expDays) payload.expTime = Date.now() + assignForm.expDays * 86400000;
      if (assignForm.flowGb) payload.flow = Math.round(assignForm.flowGb * 1024 * 1024 * 1024);
      const res = await assignAllToUser(payload);
      if (res.code === 0) {
        toast.success(`已分配 ${res.data?.assigned ?? 0} 个协议` + (res.data?.skipped ? `,跳过 ${res.data.skipped}(已分过)` : "") + " · 订阅去「用户管理」拿");
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
    if (!window.confirm(`确定清空「${nodeName}」上的所有协议?(连带其转发/用户)`)) return;
    const res = await deleteInboundsByNode(nodeId);
    if (res.code === 0) {
      toast.success("已清空该机协议");
      loadAll();
    } else {
      toast.error(res.msg || "清空失败");
    }
  };

  // 中转机器 = 有落地(landing_id)入站的节点
  const relayNodes = nodes.filter((n) => inbounds.some((ib) => ib.nodeId === n.id && ib.landingId));

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">中转</h1>
        <Button
          color="secondary"
          onPress={() => {
            setBuildForm({ nodeId: null, name: "", link: "" });
            setTestResult(null);
            setBuildOpen(true);
          }}
        >
          ⚡ 搭中转
        </Button>
      </div>

      <div className="text-xs text-default-500">
        中转 = 前置机搭协议(抗封锁),流量经「落地」出网。车友连的还是前置机的订阅,只是出口 IP 换成落地那台的。分配/限速/订阅与协议管理完全一致。
      </div>

      {/* 一前置机一卡:全套协议 + 它的落地 */}
      <div className="grid gap-3 md:grid-cols-2">
        {relayNodes.map((n) => {
          const nodeInbounds = inbounds.filter((ib) => ib.nodeId === n.id && ib.landingId);
          const online = n.status === 1;
          const firstIp = n.ip ? String(n.ip).split(",")[0].trim() : (n.serverIp || "");
          const lids = Array.from(new Set(nodeInbounds.map((ib) => ib.landingId)));
          return (
            <Card key={n.id}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold truncate">🖥️ {n.name}</span>
                  <Chip size="sm" variant="flat" color={online ? "success" : "default"}>{online ? "在线" : "离线"}</Chip>
                  <Chip size="sm" variant="flat" color="primary" className="ml-auto">{nodeInbounds.length} 协议</Chip>
                </div>
                {firstIp && <div className="text-xs text-default-500 font-mono">前置机 {firstIp}</div>}
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-default-500">落地 →</span>
                  {lids.map((lid) => {
                    const l = landingById(lid);
                    return (
                      <Chip key={String(lid)} size="sm" variant="flat" color="warning">
                        {l ? `${l.name}(${l.type})` : `落地#${lid}`}
                      </Chip>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {nodeInbounds.map((ib) => (
                    <Chip key={ib.id} size="sm" variant="flat" color="secondary">{protoLabel(ib.protocol)}</Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" color="primary" className="flex-1" onPress={() => openNodeAssign(n, nodeInbounds.length)}>
                    👤 分配用户
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => handleClearNode(n.id, n.name)}>
                    清空该机
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      {relayNodes.length === 0 && (
        <div className="text-center text-default-400 py-8">
          还没有中转。点右上角「⚡ 搭中转」→ 选前置机 + 粘贴落地(住宅 socks 或协议链接)→ 测试通 → 搭建。
        </div>
      )}

      {/* 分配用户(复用协议管理的整机分配) */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)}>
        <ModalContent>
          <ModalHeader>👤 给车友分配「{assignForm.nodeName}」(中转)</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              把这台前置机的 <b>{assignForm.protocolCount} 个协议</b> 一次分给车友,出口走落地。分配完到「用户管理」拿这条中转订阅链接。
            </div>
            <Select
              label="子账号(车友)"
              placeholder="选一个车友"
              selectedKeys={assignForm.userId ? [String(assignForm.userId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, userId: Number(Array.from(k)[0]) })}
            >
              {users.map((u) => (<SelectItem key={u.id}>{u.user}</SelectItem>))}
            </Select>
            <Select
              label="限速规则(可空)"
              placeholder="不限速"
              selectedKeys={assignForm.speedId ? [String(assignForm.speedId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, speedId: Number(Array.from(k)[0]) })}
            >
              {speedRules.map((s) => (<SelectItem key={s.id}>{s.name}</SelectItem>))}
            </Select>
            <Input
              type="number"
              label="到期(天,留空=永久)"
              value={assignForm.expDays ?? ""}
              onChange={(e) => setAssignForm({ ...assignForm, expDays: e.target.value ? Number(e.target.value) : null })}
            />
            <Input
              type="number"
              label="流量配额(GB,留空=不限)"
              value={assignForm.flowGb ?? ""}
              onChange={(e) => setAssignForm({ ...assignForm, flowGb: e.target.value ? Number(e.target.value) : null })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setAssignOpen(false)}>关闭</Button>
            <Button color="primary" isLoading={assignLoading} onPress={handleNodeAssign}>分配</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 搭中转:选前置机 + 内联填落地 + 测试 + 搭建 */}
      <Modal isOpen={buildOpen} onClose={() => setBuildOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>⚡ 搭中转</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              选前置机 + 填落地出口 → 测试通了 → 搭建。前置机上建全套协议,流量经落地出网。
            </div>
            <Select
              label="前置机(客户端连的那台)"
              placeholder="选一台前置机(需在线)"
              selectedKeys={buildForm.nodeId ? [String(buildForm.nodeId)] : []}
              onSelectionChange={(k) => { setBuildForm({ ...buildForm, nodeId: Number(Array.from(k)[0]) }); setTestResult(null); }}
            >
              {nodes.map((n) => (<SelectItem key={n.id}>{n.name}</SelectItem>))}
            </Select>
            <Input
              label="落地名称(自己起)"
              placeholder="如 泰国住宅"
              value={buildForm.name}
              onChange={(e) => setBuildForm({ ...buildForm, name: e.target.value })}
            />
            <Textarea
              label="落地出口(粘贴)"
              placeholder="住宅socks: IP:端口:账号:密码    协议节点: ss:// / vmess:// / vless:// / trojan:// / hysteria2://"
              minRows={2}
              value={buildForm.link}
              onChange={(e) => { setBuildForm({ ...buildForm, link: e.target.value }); setTestResult(null); }}
              description="住宅 socks 直接填 IP:端口:账号:密码;机场/别人节点整条分享链接粘进来。测试会经前置机试连、显示出口 IP"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" color="secondary" isLoading={testLoading} onPress={handleTest}>🔌 测试落地</Button>
              {testResult && (
                testResult.skipped ? (
                  <span className="text-xs text-default-500">{testResult.msg}</span>
                ) : testResult.ok ? (
                  <span className="text-xs text-success">✅ 通了 · 出口 IP <b className="font-mono">{testResult.exitIp}</b> · {testResult.latencyMs}ms</span>
                ) : (
                  <span className="text-xs text-danger">❌ {testResult.msg || "不通"}</span>
                )
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setBuildOpen(false)}>取消</Button>
            <Button color="secondary" isLoading={buildLoading} onPress={handleBuild}>保存并搭建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
