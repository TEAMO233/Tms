import type { ComponentType, SVGProps } from "react";

import {
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ArrowsRightLeftIcon,
  CircleStackIcon,
  ClockIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  LinkIcon,
  ScaleIcon,
  ServerStackIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline";

export type NavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavigationItem {
  path: string;
  label: string;
  icon: NavigationIcon;
  adminOnly?: boolean;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "工作台",
    items: [
      {
        path: "/dashboard",
        label: "仪表板",
        icon: Squares2X2Icon,
        adminOnly: true,
      },
      { path: "/my-sub", label: "我的订阅", icon: LinkIcon },
    ],
  },
  {
    label: "基础设施",
    items: [
      {
        path: "/node",
        label: "转发机",
        icon: ServerStackIcon,
        adminOnly: true,
      },
      { path: "/inbound", label: "协议管理", icon: ScaleIcon, adminOnly: true },
      {
        path: "/relay",
        label: "中转",
        icon: ArrowsRightLeftIcon,
        adminOnly: true,
      },
      {
        path: "/transparent-relay",
        label: "透明中转",
        icon: ArrowsPointingOutIcon,
        adminOnly: true,
      },
    ],
  },
  {
    label: "账户与规则",
    items: [
      { path: "/user", label: "用户管理", icon: UsersIcon, adminOnly: true },
      { path: "/limit", label: "限速管理", icon: ClockIcon, adminOnly: true },
      {
        path: "/tunnel",
        label: "隧道管理",
        icon: CircleStackIcon,
        adminOnly: true,
      },
      {
        path: "/forward",
        label: "转发管理",
        icon: ArrowDownTrayIcon,
        adminOnly: true,
      },
    ],
  },
];

export const secondaryNavigation: NavigationItem[] = [
  { path: "/config", label: "网站配置", icon: Cog6ToothIcon, adminOnly: true },
  {
    path: "/guide",
    label: "使用说明",
    icon: InformationCircleIcon,
    adminOnly: true,
  },
];

export function canShowNavigationItem(item: NavigationItem, admin: boolean) {
  return !item.adminOnly || admin;
}
