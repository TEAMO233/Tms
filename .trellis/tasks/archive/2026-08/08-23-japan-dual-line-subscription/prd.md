# 一键搭建日本双线路节点订阅

## Goal

在日本转发机上同时提供两套协议线路，并让用户在「我的订阅」中一次获取：

1. 日本直连线路：客户端 → 日本协议 → 日本本机出网；
2. 日本中转线路：客户端 → 日本协议 → 新加坡同协议节点 → 新加坡出网。

目标是把目前需要手动查端口、逐条创建转发的流程收敛成可重复执行的一键配置，并复用现有用户分配、限速/流量/到期和订阅机制。

## Confirmed repository facts

- `InboundServiceImpl.oneClickCreate` 当前在指定节点创建 6 个协议入站：VLESS、Trojan、VMess、Hysteria2、TUIC、AnyTLS。[springboot-backend/src/main/java/com/admin/service/impl/InboundServiceImpl.java:195]
- `InboundServiceImpl.oneClickRelay` 当前可以在前置机创建同样的 6 个协议入站，并给每个入站设置同一个 `landing_id`。[springboot-backend/src/main/java/com/admin/service/impl/InboundServiceImpl.java:225]
- 当前一键中转的实现是“一个落地链接对应六个日本协议”，还不能按协议把日本 HY2、VLESS 等分别映射到新加坡同协议节点；新功能需要在保留旧入口的前提下增加协议映射组。[springboot-backend/src/main/java/com/admin/service/impl/InboundServiceImpl.java:225]
- `SingboxUtil.buildNodeConfig` 会把带 `landing_id` 的入站路由到落地出站；无 `landing_id` 的入站保持 direct 出站。[springboot-backend/src/main/java/com/admin/common/utils/SingboxUtil.java:99]
- `InboundLine` 已按「用户 × 机器 × 落地组」建模，因此同一日本节点可以同时存在直连线路和中转线路。[springboot-backend/src/main/java/com/admin/entity/InboundLine.java:9]
- `/inbound/my-lines` 和 `my-sub.tsx` 已支持直连/中转两条线路及聚合订阅展示。[springboot-backend/src/main/java/com/admin/service/impl/InboundServiceImpl.java:823]、[vite-frontend/src/pages/my-sub.tsx:130]
- 当前中转入口要求一个可解析的落地分享链接，不是直接选择一个「节点」作为落地；一键中转的 UI 也明确是“前置机 + 落地出口(粘贴)”。[vite-frontend/src/pages/relay.tsx:371]

## Requirements

### R1. 日本双线路

- 指定日本节点后，可建立/复用一套日本直连协议和一套日本中转协议。
- 直连组包含 6 个协议；中转组包含 6 个协议。
- 选择新加坡落地节点后，系统自动读取该节点已有的 6 个协议，并按相同协议一一匹配；用户不需要手动查端口或逐条新增落地。
- 重复执行必须幂等，不重复创建相同协议、用户凭证、落地或转发。

### R2. 新加坡落地

- 中转组的最终出口必须是新加坡，且日本每个协议只能进入新加坡对应协议的出口。
- 新加坡节点缺少任一所需协议、协议没有可用的连接凭证/公网入口或配置不可解析时，配置应整体失败并列出缺失协议。
- 新加坡落地配置不能影响日本直连组的出网路径。

### R3. 用户分配与订阅

- 可将直连组和中转组分别分配给用户/当前管理员自己。
- 一键配置界面提供“同时开通我自己”选项，默认开启；只自动开通当前操作用户，不自动给其他用户分配。
- 「我的订阅」应显示两条线路：日本直连和日本中转→新加坡；每条线路包含 6 个协议。
- 中转线路的 6 个协议仍作为一组订阅展示，但每个协议内部使用自己的新加坡对应出口。
- 聚合订阅应包含两条线路的全部协议。
- 保留现有 UUID、密码、Reality 参数、限速、流量、到期和线路状态语义。

### R4. 生命周期与可维护性

- 一键配置失败时，不得留下不可用的半套协议、落地或转发。
- 删除、停用、重新分配和续费时，直连组与中转组应互不误删、互不影响。
- 自动创建的内部转发继续隐藏在普通转发列表中，并可通过线路/协议页面追踪。

## Key Decisions

- 中转组改为 6 个协议一一映射：日本 VLESS→新加坡 VLESS、Trojan→Trojan、VMess→VMess、Hysteria2→Hysteria2、TUIC→TUIC、AnyTLS→AnyTLS。
- 用户侧只选择日本入口节点和新加坡落地节点；系统从新加坡协议管理中已有的六个入站生成/复用内部落地映射，不要求用户手动创建六条 Landing。
- 日本直连组使用 `landing_id = null`；中转组需要一个逻辑 relay group，并在组内保存六个“日本协议→新加坡落地配置”的映射，以便订阅仍按两组线路展示。
- 一键配置和当前用户授权在同一个界面完成；授权动作复用现有 `assign-self` 语义，不改变普通用户分配流程。
- 本次目标是“一键创建/复用两组协议并接入订阅”，不是把新加坡现有 6 个协议端口逐一搬运成日本 GOST 端口。

## Acceptance Criteria

- [ ] 在日本节点执行一次直连配置后，能看到 6 个日本本机出网协议。
- [ ] 选择同一日本节点和新加坡落地节点执行一次中转配置后，能看到 6 个日本前置；每个日本协议的流量均进入新加坡同协议出口。
- [ ] 一键配置并保持“同时开通我自己”后，「我的订阅」显示 2 条线路、共 12 个协议；聚合订阅可一次拉取全部 12 个协议。
- [ ] 更新订阅或重复点击配置不会产生重复协议、重复用户凭证或重复转发。
- [ ] 停用/删除中转组不会删除日本直连组；停用/删除直连组不会删除中转组。
- [ ] 现有限速、流量统计、到期停用和续费恢复行为通过现有测试/回归验证。
