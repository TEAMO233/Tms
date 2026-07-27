import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import toast from "react-hot-toast";
import { getMyLines, getUserPackageInfo } from "@/api";
import { copyTextToClipboard } from "@/utils/clipboard";

/**
 * 我的订阅(车友视角):套餐概况 + 自己的所有订阅线路(直连/中转各一条)。
 * 车友只管拿链接导客户端,内部的转发管道对他隐藏。
 */
export default function MySubPage() {
  const [lines, setLines] = useState<any[]>([]);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const subUrl = (token: string) => `${window.location.origin}/api/v1/open_api/sub?token=${token}`;

  const load = async () => {
    try {
      const [ln, pkg] = await Promise.all([getMyLines(), getUserPackageInfo()]);
      if (ln.code === 0) setLines(ln.data || []);
      if (pkg.code === 0) setInfo(pkg.data?.userInfo || null);
    } catch (e) {
      toast.error("加载失败");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const fmtGB = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 GB";
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
  };
  const usedBytes = ((info?.inFlow || 0) + (info?.outFlow || 0)) as number;
  const totalBytes = info?.flow ? info.flow * 1024 * 1024 * 1024 : 0;
  const pct = totalBytes > 0 ? Math.min(100, (usedBytes / totalBytes) * 100) : 0;
  const expText = info?.expTime ? new Date(info.expTime).toLocaleDateString() : "永久";

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold">我的订阅</h1>

      {/* 套餐概况 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-default-500 text-xs">已用流量</div>
              <div className="text-lg font-semibold">
                {fmtGB(usedBytes)}
                {totalBytes > 0 && <span className="text-default-400 text-sm"> / {info.flow} GB</span>}
              </div>
            </div>
            <div>
              <div className="text-default-500 text-xs">到期时间</div>
              <div className="text-lg font-semibold">{expText}</div>
            </div>
            <div>
              <div className="text-default-500 text-xs">线路数</div>
              <div className="text-lg font-semibold">{lines.length}</div>
            </div>
          </div>
          {totalBytes > 0 && (
            <div>
              <div className="w-full h-2 bg-default-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct > 90 ? "bg-danger" : pct > 70 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-default-400 mt-1">
                {pct.toFixed(1)}% 已用 · 所有线路共用这一份流量配额
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 我的线路 */}
      {loading ? (
        <div className="text-center text-default-400 py-8">加载中...</div>
      ) : lines.length === 0 ? (
        <Card>
          <CardBody className="text-center text-default-400 py-8">
            还没有线路。联系管理员给你分配。
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {lines.map((ln: any, idx: number) => {
            const url = subUrl(ln.subToken);
            const isRelay = ln.type === "relay";
            return (
              <Card key={idx}>
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip size="sm" variant="flat" color={isRelay ? "warning" : "primary"}>
                      {isRelay ? `🔀 中转${ln.landingName ? "→" + ln.landingName : ""}` : "🖥️ 直连"}
                    </Chip>
                    <span className="font-medium truncate">{ln.nodeName}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {/* 这条线路各自用了多少(总配额是全部线路共用的,见顶部) */}
                      <span className="text-xs text-default-500">本线路已用 {fmtGB(ln.flow || 0)}</span>
                      <Chip size="sm" variant="flat">{ln.protocolCount} 协议</Chip>
                    </div>
                  </div>
                  <Input
                    readOnly
                    size="sm"
                    value={url}
                    onClick={(e: any) => { if (e.target?.select) e.target.select(); }}
                  />
                  <Button
                    size="sm"
                    color="primary"
                    onPress={async () => {
                      (await copyTextToClipboard(url))
                        ? toast.success("已复制,去客户端粘贴")
                        : toast.error("复制失败,点框内已全选,按 Ctrl+C");
                    }}
                  >
                    复制订阅链接
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* 用法 */}
      <Card>
        <CardBody className="space-y-2 text-sm text-default-600">
          <div className="font-semibold">怎么用</div>
          <div>复制上面任意一条订阅链接,在客户端里添加订阅:</div>
          <ul className="list-disc pl-5 space-y-1 text-default-500">
            <li><b>v2rayN(Windows)</b>:订阅 → 订阅分组设置 → 添加 → 粘贴地址 → 确定 → 更新订阅</li>
            <li><b>小火箭 / Shadowrocket(iOS)</b>:右上角 + → 类型选「Subscribe」→ 粘贴地址</li>
            <li><b>v2rayNG(安卓)</b>:左侧菜单 → 订阅分组设置 → + → 粘贴地址 → 更新订阅</li>
          </ul>
          <div className="text-xs text-default-400">
            一条订阅 = 一条线路的全部协议;管理员加了新协议,你更新订阅就自动出现。哪条快用哪条。
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
