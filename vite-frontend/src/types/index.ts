import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface FlowStatisticsRangeQuery {
  startTime: number;
  endTime: number;
}

export interface FlowStatisticsPoint {
  label: string;
  startTime: number;
  endTime: number;
  flow: number;
}

export interface FlowStatisticsResponse {
  granularity: "hour" | "day";
  startTime: number;
  endTime: number;
  totalFlow: number;
  points: FlowStatisticsPoint[];
}

// 用户管理相关类型
export interface User {
  id: number;
  name?: string;
  user: string;
  pwd?: string;
  status: number; // 1-正常, 0-禁用
  flow: number; // 流量限制(GB)
  num: number; // 转发数量
  expTime?: number; // 过期时间戳
  flowResetTime?: number; // 流量重置日期(1-31号)
  createdTime?: number; // 创建时间戳
  inFlow?: number; // 下载流量(字节)
  outFlow?: number; // 上传流量(字节)
}

export interface UserForm {
  id?: number;
  name?: string;
  user: string;
  pwd?: string;
  status: number;
  flow: number;
  num: number;
  expTime: Date | null;
  flowResetTime: number;
}

export interface UserTunnel {
  id: number;
  userId: number;
  tunnelId: number;
  tunnelName: string;
  status: number; // 1-正常, 0-禁用
  flow: number; // 流量限制(GB)
  num: number; // 转发数量
  expTime: number; // 过期时间戳
  flowResetTime: number; // 流量重置日期
  speedId?: number | null; // 限速规则ID
  speedLimitName?: string; // 限速规则名称
  inFlow?: number; // 下载流量(字节)
  outFlow?: number; // 上传流量(字节)
  tunnelFlow?: number; // 隧道流量计算类型(1-单向, 2-双向)
}

export interface UserTunnelForm {
  tunnelId: number | null;
  flow: number;
  num: number;
  expTime: Date | null;
  flowResetTime: number;
  speedId: number | null;
}

export interface Tunnel {
  id: number;
  name: string;
  entryNodeId: number;
  exitNodeId: number;
  entryNodeName?: string;
  exitNodeName?: string;
  status?: number;
  flow?: number; // 流量计算类型
}

export interface Forward {
  id: number;
  name: string;
  tunnelId: number;
  tunnelName: string;
  inIp: string;
  inPort: number;
  remoteAddr: string;
  interfaceName?: string;
  strategy: string;
  status: number;
  inFlow: number;
  outFlow: number;
  serviceRunning: boolean;
  createdTime: string;
  userName?: string;
  userId?: number;
  inx?: number;
  expTime?: number;
  speedId?: number;
  /** 手动填写的原始协议分享链接；自动协议转发可能没有此字段 */
  sourceLink?: string | null;
  /** 搭协议/搭中转自动生成的内部管道,默认不显示在这一页 */
  protocolManaged?: boolean;
}

export interface ForwardForm {
  id?: number;
  userId?: number;
  name: string;
  tunnelId: number | null;
  inPort: number | null;
  remoteAddr: string;
  interfaceName?: string;
  strategy: string;
  expTime?: number | null;
  speedId?: number | null;
  sourceLink?: string;
}

export interface ForwardClientLinkResponse {
  link: string;
}

export interface ForwardSubscriptionResponse {
  subToken: string;
  availableCount: number;
  skippedCount: number;
}

export interface TransparentRelay {
  id: number;
  name: string;
  inNodeId: number;
  inNodeName?: string;
  inNodeIp?: string;
  inNodeServerIp?: string;
  entryPort: number;
  targetHost: string;
  targetPort: number;
  protocol: 'tcp' | 'udp' | 'tcp_udp' | 'hysteria2' | 'tuic';
  masquerade: boolean;
  lastError?: string | null;
  createdTime?: number;
  updatedTime?: number;
  status: number;
  relayType?: 'l4' | 'udp_quic';
  inboundId?: number;
  landingId?: number;
  forwardId?: number;
  landingName?: string;
  targetName?: string;
}

export interface TransparentRelayForm {
  id?: number;
  name: string;
  inNodeId: number | null;
  entryPort: number | null;
  targetHost: string;
  targetPort: number | null;
  protocol: 'tcp' | 'udp' | 'tcp_udp';
}

export interface TransparentRelayBatchForm {
  inNodeId: number | null;
  targetHost: string;
}

export interface TransparentRelayBatchResult {
  targetCount: number;
  createdCount: number;
  skippedCount: number;
  createdPorts: number[];
  skippedPorts: number[];
  skippedQuicProtocols?: string[];
}

export interface TransparentRelaySubscriptionResult {
  subToken: string;
  availableCount: number;
  skippedCount: number;
}

export interface UdpQuicRelayCreateForm {
  ingressNodeId: number | null;
  targetNodeId: number | null;
  protocols: Array<"hysteria2" | "tuic">;
}

export interface UdpQuicRelayResult {
  protocol: string;
  landingId?: number;
  inboundId?: number;
  forwardId?: number;
  entryPort?: number;
  subToken?: string;
  link?: string;
  createdLanding?: boolean;
  createdInbound?: boolean;
  assignedUser?: boolean;
  skippedReason?: string;
}

export interface TransparentRelayStatusResponse {
  ipForward?: boolean;
  exists?: boolean;
  ruleset?: string;
}

export interface SpeedLimit {
  id: number;
  name: string;
  tunnelId: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

export interface Pagination {
  current: number;
  size: number;
  total: number;
}
