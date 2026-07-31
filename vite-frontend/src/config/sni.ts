/**
 * Reality「伪装域名」候选(借壳 SNI)。
 *
 * 无域名搭 Reality 时,握手时对外表现成访问这个站点,所以要挑:
 * 国外大站、支持 TLS1.3+X25519、国内没被墙、且不在你机器所在地被劫持。
 *
 * ⚠️ 别用 www.microsoft.com —— 它启用了后量子密钥交换,Reality 握不上手,
 *    搭完连不上十有八九栽在这(踩过)。
 */
export const SNI_PRESETS = [
  { value: "www.apple.com", label: "www.apple.com(默认,最稳)" },
  { value: "www.icloud.com", label: "www.icloud.com" },
  { value: "www.bing.com", label: "www.bing.com" },
  { value: "www.cloudflare.com", label: "www.cloudflare.com" },
  { value: "www.amazon.com", label: "www.amazon.com" },
  { value: "www.nvidia.com", label: "www.nvidia.com" },
  { value: "www.tesla.com", label: "www.tesla.com" },
  { value: "addons.mozilla.org", label: "addons.mozilla.org" },
];

export const DEFAULT_SNI = "www.apple.com";
