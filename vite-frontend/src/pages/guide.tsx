import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";

/**
 * 使用说明:四个功能(协议管理 / 中转 / 端口转发 / 隧道转发)啥区别、啥时候用哪个。
 * 纯说明页,侧栏「使用说明」进来。
 */
export default function GuidePage() {
  return (
    <div className="p-4 space-y-5 max-w-4xl">
      <h1 className="text-xl font-bold">使用说明</h1>

      {/* 一句话概览 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">四个功能,一句话</div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2 items-start">
              <Chip size="sm" color="primary" variant="flat">协议管理</Chip>
              <span>给车友卖翻墙 · 出口在<b>本机</b>。搭 VLESS-Reality 等协议 → 出订阅给车友。</span>
            </div>
            <div className="flex gap-2 items-start">
              <Chip size="sm" color="warning" variant="flat">中转</Chip>
              <span>给车友卖翻墙 · 出口换成<b>干净落地</b>。前置机搭协议,流量经落地(住宅 socks / 别的节点)出网。</span>
            </div>
            <div className="flex gap-2 items-start">
              <Chip size="sm" color="secondary" variant="flat">端口转发</Chip>
              <span>搬一个<b>普通端口</b>到任意地址(1 跳)。客户端拿到裸端口,不是翻墙订阅。</span>
            </div>
            <div className="flex gap-2 items-start">
              <Chip size="sm" color="default" variant="flat">隧道转发</Chip>
              <span>两台机器之间走<b>加密隧道</b>(2 跳),由后面那台去连目标。<b>只在「境内入口 → 境外裸落地」时才需要</b>,其它情况端口转发就够。</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 决策树:先看这个,省得四个功能挨个试 */}
      <Card className="border border-primary/30">
        <CardBody className="space-y-3">
          <div className="font-semibold">该用哪个?照着问两句就定了</div>
          <div className="text-sm text-default-600 space-y-3">
            <div>
              <div className="font-medium">第一问:客户端要拿到的是「订阅」还是「一个端口」?</div>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li><b>订阅</b>(给车友翻墙用)→ 出口就用这台机 = <b>协议管理</b>;出口要换成住宅 IP 或别的节点 = <b>中转</b>。到这就完了,下面不用看。</li>
                <li><b>一个端口</b>(自己用 / 搬服务)→ 接着问第二句。</li>
              </ul>
            </div>
            <div>
              <div className="font-medium">第二问:要搬的东西自己加密吗?</div>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>
                  <b>自己加密</b>(VLESS / Trojan / SS / Hysteria 这些协议)→ <b>端口转发</b>。
                  搬的是密文,过不过墙都无所谓,而且落地那台什么都不用装,别人机场的节点也能搬。
                </li>
                <li>
                  <b>裸的</b>(socks5 / SSH / 游戏 / 数据库 / 明文服务)→ 再看<b>入口机到落地这一段过不过墙</b>:
                  <ul className="list-[circle] pl-5 space-y-1 mt-1">
                    <li>不过墙(两头都在境内,或两头都在境外)→ 还是 <b>端口转发</b>。</li>
                    <li>过墙(境内入口 → 境外裸落地,比如河北直连泰国住宅 socks)→ 这才轮到 <b>隧道转发</b>:中间加一台境外机,把过墙那段包进加密隧道。</li>
                  </ul>
                </li>
              </ul>
            </div>
            <p className="text-xs text-default-500 border-t border-default-200 pt-2">
              <b>结论:隧道转发只在最后那一格才需要</b>,其它情况端口转发都够,还更省事(只有入口机要装 gost)。
              别看落地是不是裸的就下结论——关键是那段路<b>过不过墙</b>。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 进阶搭法 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">进阶:国内入口 + 住宅出口,还要能发订阅</div>
          <div className="text-sm text-default-600 space-y-2">
            <p>
              想同时拿到「客户端连国内不过墙、晚高峰稳」和「出口是干净住宅 IP」,还要有订阅能分车友——用<b>两层中转</b>,别用隧道转发:
            </p>
            <div className="font-mono text-xs bg-default-100 rounded-lg p-3 leading-relaxed overflow-x-auto">
              第一层:中转 = 前置【香港】+ 落地【泰国住宅 socks】<br />
              第二层:中转 = 前置【河北】+ 落地【第一层那条 vless:// 链接】<br />
              <br />
              客户端 --Reality--&gt; 河北 --VLESS--&gt; 香港 --socks5--&gt; 泰国住宅
            </div>
            <p className="text-xs text-default-500">
              拿第一层的链接:给它点「🔑 我自己用」拿到订阅地址,浏览器打开,把里面那条 vless:// 复制出来,粘到第二层的落地框。
            </p>
            <p className="text-xs text-default-500">
              为什么不用隧道转发做这件事:隧道方案客户端要手配裸 socks5(明文、没订阅),而且<b>住宅的账号密码得填进客户端</b>——等于把凭据交给车友。两层中转全程加密、订阅自动指向河北、每人独立 UUID 和限速,住宅凭据只留在香港那台机上。机器数量一样是两台。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 卖翻墙 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">① 卖翻墙 → 协议管理 / 中转</div>
          <div className="text-sm text-default-600 space-y-2">
            <p>车友用 v2rayN 等客户端,拿的是一条<b>订阅链接</b>,抗封锁、自动更新。区别只在<b>出口从哪出</b>:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>协议管理</b>:出口就是搭协议的那台机器本身(本机落地)。</li>
              <li><b>中转</b>:出口换成"落地"那台——住宅 socks(干净家宽 IP)、别人机场节点、或你另一台机器。前置机负责抗封锁,落地负责干净出口。</li>
            </ul>
            <p className="text-xs text-default-500">
              订阅按<b>线路</b>算:一个车友分到几台机器/几个中转,就有几条订阅(用户管理里各是各的链接)。同一台机器的直连和中转,各算一条,互不影响。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 搬端口 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">② 搬普通端口 / 自己机器互联 → 端口转发 / 隧道转发</div>
          <div className="text-sm text-default-600 space-y-2">
            <p>这俩给的是<b>裸端口</b>(IP:端口),客户端不是翻墙客户端(比如游戏、网站、API、SSH、你自己的服务)。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>端口转发</b>(1 跳):借一台线路好的入口机,把流量转发到<b>任意地址</b>(别人的服务 / 住宅 socks / 你的机器)。常用于优质线路加速、给被墙/内网的服务套个干净入口。</li>
              <li><b>隧道转发</b>(2 跳,加密):入口机和出口机之间走加密隧道,再由<b>出口机</b>去连远程地址。要装 gost 的是这两台,远程地址本身可以是任意地址(住宅 socks、别人的服务都行)。只有「境内入口 → 境外裸落地」这种过墙路径才需要它,其它时候端口转发就够。</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* 对照表 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">对照表</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-default-500 border-b border-default-200">
                  <th className="py-2 pr-3"></th>
                  <th className="py-2 pr-3">协议管理</th>
                  <th className="py-2 pr-3">中转</th>
                  <th className="py-2 pr-3">端口转发</th>
                  <th className="py-2 pr-3">隧道转发</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-default-100">
                <tr><td className="py-2 pr-3 text-default-500">客户端拿到</td><td className="py-2 pr-3">订阅</td><td className="py-2 pr-3">订阅</td><td className="py-2 pr-3">裸端口</td><td className="py-2 pr-3">裸端口</td></tr>
                <tr><td className="py-2 pr-3 text-default-500">抗封锁伪装</td><td className="py-2 pr-3">有</td><td className="py-2 pr-3">有</td><td className="py-2 pr-3">无</td><td className="py-2 pr-3">入口→出口有</td></tr>
                <tr><td className="py-2 pr-3 text-default-500">出口在哪</td><td className="py-2 pr-3">本机</td><td className="py-2 pr-3">落地(任意)</td><td className="py-2 pr-3">任意地址</td><td className="py-2 pr-3">出口机去连的任意地址</td></tr>
                <tr><td className="py-2 pr-3 text-default-500">要装 gost 的机器</td><td className="py-2 pr-3">1 台</td><td className="py-2 pr-3">1 台(前置机)</td><td className="py-2 pr-3">1 台(入口机)</td><td className="py-2 pr-3">2 台(入口+出口)</td></tr>
                <tr><td className="py-2 pr-3 text-default-500">跳数</td><td className="py-2 pr-3">1</td><td className="py-2 pr-3">2(前置+落地)</td><td className="py-2 pr-3">1</td><td className="py-2 pr-3">2(加密)</td></tr>
                <tr><td className="py-2 pr-3 text-default-500">卖给谁</td><td className="py-2 pr-3">翻墙车友</td><td className="py-2 pr-3">翻墙车友</td><td className="py-2 pr-3">要搬端口的</td><td className="py-2 pr-3">要搬端口的</td></tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 常见问题 */}
      <Card>
        <CardBody className="space-y-3">
          <div className="font-semibold">常见问题</div>
          <div className="text-sm text-default-600 space-y-3">
            <div>
              <div className="font-medium">端口转发 socks 为啥要"国内机开头",香港放第一个就用不了?</div>
              <p className="text-default-500">
                端口转发是<b>裸转发、不加密不伪装</b>。客户端家宽直连香港这一跳要穿墙,裸 socks 容易被 GFW 识别/干扰、香港 IP 也容易被封,加上家宽国际线路本来就烂 → 连不上。
                加一台国内机顶在前面:客户端连国内(快、不穿墙),国内机再用优质专线到香港。<b>而协议管理/中转用 Reality 伪装,客户端直连香港就行,不需要国内机。</b>
              </p>
            </div>
            <div>
              <div className="font-medium">流量和到期为什么有两个地方能设?</div>
              <p className="text-default-500">
                分两层,不重复:<b>用户管理</b>里的流量限制只对<b>端口转发/隧道转发</b>生效,过期时间是<b>账号总到期</b>(到点这个人所有线路全停);
                <b>分配用户</b>时设的流量和到期,只管<b>这一条线路</b>——超了只停这条,车友其它线路照用。
                所以中转(住宅 IP、流量贵)可以单独卡个小额度,直连给大额度,互不影响。
              </p>
            </div>
            <div>
              <div className="font-medium">车友的协议全 -1 / 连不上,但节点显示在线?</div>
              <p className="text-default-500">
                多半是节点的 gost 太旧、缺自签证书,导致 sing-box 起不来(一个协议崩,整台机的协议全崩)。把该节点的 gost 更新到最新版即可(新装的节点不会有这问题)。
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
