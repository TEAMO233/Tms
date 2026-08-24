package com.admin.service.impl;

import com.admin.common.dto.ForwardSubscriptionLinkDto;
import com.admin.common.dto.ForwardSubscriptionLinkResultDto;
import com.admin.common.dto.GostDto;
import com.admin.common.dto.TransparentRelayBatchDto;
import com.admin.common.dto.TransparentRelayBatchResultDto;
import com.admin.common.dto.TransparentRelayDto;
import com.admin.common.dto.TransparentRelayListDto;
import com.admin.common.dto.TransparentRelayStatusDto;
import com.admin.common.dto.TransparentRelaySubscriptionResultDto;
import com.admin.common.dto.TransparentRelayUpdateDto;
import com.admin.common.lang.R;
import com.admin.common.utils.ClientLinkUtil;
import com.admin.common.utils.JwtUtil;
import com.admin.common.utils.TransparentRelayUtil;
import com.admin.entity.Forward;
import com.admin.entity.Inbound;
import com.admin.entity.InboundUser;
import com.admin.entity.Landing;
import com.admin.entity.Node;
import com.admin.entity.TransparentRelay;
import com.admin.entity.Tunnel;
import com.admin.entity.User;
import com.admin.mapper.InboundUserMapper;
import com.admin.mapper.LandingMapper;
import com.admin.mapper.TransparentRelayMapper;
import com.admin.mapper.UserMapper;
import com.admin.service.ForwardService;
import com.admin.service.InboundService;
import com.admin.service.NodeService;
import com.admin.service.TransparentRelayService;
import com.admin.service.TunnelService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransparentRelayServiceImpl extends ServiceImpl<TransparentRelayMapper, TransparentRelay> implements TransparentRelayService {

    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_PAUSED = 0;
    private static final int STATUS_ERROR = -1;
    private static final String GOST_SUCCESS_MSG = "OK";
    private static final List<String> SUPPORTED_PROTOCOLS = Arrays.asList("tcp", "udp", "tcp_udp");

    @Resource
    private NodeService nodeService;

    @Resource
    private ForwardService forwardService;

    @Resource
    private InboundService inboundService;

    @Resource
    private TunnelService tunnelService;

    @Resource
    private UserMapper userMapper;

    @Resource
    private InboundUserMapper inboundUserMapper;

    @Resource
    private LandingMapper landingMapper;

    @Override
    public R createRelay(TransparentRelayDto dto) {
        Node node = dto.getInNodeId() == null ? null : nodeService.getNodeById(dto.getInNodeId());
        if (node == null) {
            return R.err("入口节点不存在");
        }
        Integer entryPort;
        try {
            entryPort = resolveEntryPort(node, dto.getEntryPort(), null);
        } catch (IllegalStateException e) {
            return R.err(e.getMessage());
        }
        R validation = validateRelayInput(dto.getName(), dto.getInNodeId(), entryPort, dto.getTargetHost(), dto.getTargetPort(), dto.getProtocol(), null);
        if (validation.getCode() != 0) {
            return validation;
        }

        TransparentRelay relay = new TransparentRelay();
        BeanUtils.copyProperties(dto, relay);
        relay.setEntryPort(entryPort);
        relay.setProtocol(normalizeProtocol(dto.getProtocol()));
        relay.setTargetHost(dto.getTargetHost().trim());
        relay.setName(dto.getName().trim());
        relay.setMasquerade(true);
        relay.setStatus(STATUS_ACTIVE);
        relay.setCreatedTime(System.currentTimeMillis());
        relay.setUpdatedTime(System.currentTimeMillis());

        if (!this.save(relay)) {
            return R.err("透明中转创建失败");
        }

        R apply = applyNodeRelays(relay.getInNodeId());
        if (apply.getCode() != 0) {
            this.removeById(relay.getId());
            return apply;
        }
        return R.ok(relay);
    }

    @Override
    public R createBatchRelays(TransparentRelayBatchDto dto) {
        Node ingressNode = dto.getInNodeId() == null ? null : nodeService.getNodeById(dto.getInNodeId());
        if (ingressNode == null) {
            return R.err("入口节点不存在");
        }
        String targetHost = dto.getTargetHost() == null ? "" : dto.getTargetHost().trim();
        if (targetHost.isEmpty()) {
            return R.err("目标地址不能为空");
        }
        if (isLoopbackTarget(targetHost)) {
            return R.err("透明中转目标不能填写127.0.0.1/localhost,请填写入口机可访问的主服务器地址");
        }
        if (!isIpv4Target(targetHost)) {
            return R.err("批量透明中转目标地址只支持已登记目标节点的IPv4");
        }
        Node targetNode = findTargetNode(targetHost);
        if (targetNode == null) {
            return R.err("目标IPv4没有匹配到已登记节点,无法知道要批量生成哪些端口");
        }

        Long currentUserId = currentUserIdFromToken();
        if (currentUserId == null) {
            return R.err("未登录");
        }
        List<Forward> targetForwards = findTargetForwardCandidates(targetNode.getId(), currentUserId);
        if (targetForwards.isEmpty()) {
            return R.err("当前登录用户在目标机器上没有找到已启用的目标端口");
        }

        Set<Integer> occupiedEntryPorts = collectOccupiedEntryPorts(ingressNode.getId(), null);
        Random random = new Random();
        List<TransparentRelay> relaysToCreate = new ArrayList<>();
        List<Integer> createdPorts = new ArrayList<>();
        List<Integer> skippedPorts = new ArrayList<>();
        List<String> skippedQuicProtocols = new ArrayList<>();
        long now = System.currentTimeMillis();

        for (Forward forward : targetForwards) {
            Integer targetPort = forward.getInPort();
            String protocolValue = resolveForwardProtocolValue(targetNode.getId(), forward);
            if (isUdpQuicProxyProtocol(protocolValue)) {
                skippedPorts.add(targetPort);
                skippedQuicProtocols.add(protocolDisplayName(protocolValue));
                continue;
            }
            if (hasExistingTargetRelay(ingressNode.getId(), targetHost, targetPort, "tcp_udp")) {
                skippedPorts.add(targetPort);
                continue;
            }
            Integer entryPort;
            try {
                entryPort = pickAvailableEntryPort(ingressNode, occupiedEntryPorts, random);
            } catch (IllegalStateException e) {
                return R.err(e.getMessage());
            }
            occupiedEntryPorts.add(entryPort);

            TransparentRelay relay = new TransparentRelay();
            String protocolName = resolveForwardProtocolLabel(targetNode.getId(), forward);
            relay.setName(buildBatchRelayName(ingressNode, targetNode, forward, protocolName));
            relay.setInNodeId(ingressNode.getId());
            relay.setEntryPort(entryPort);
            relay.setTargetHost(targetHost);
            relay.setTargetPort(targetPort);
            relay.setProtocol("tcp_udp");
            relay.setMasquerade(true);
            relay.setStatus(STATUS_ACTIVE);
            relay.setCreatedTime(now);
            relay.setUpdatedTime(now);
            relaysToCreate.add(relay);
            createdPorts.add(targetPort);
        }

        TransparentRelayBatchResultDto result = new TransparentRelayBatchResultDto(
                targetForwards.size(), relaysToCreate.size(), skippedPorts.size(), createdPorts, skippedPorts);
        result.setSkippedQuicProtocols(skippedQuicProtocols);
        if (relaysToCreate.isEmpty()) {
            return R.ok(result);
        }
        if (!this.saveBatch(relaysToCreate)) {
            return R.err("批量创建透明中转失败");
        }
        R apply = applyNodeRelays(ingressNode.getId());
        if (apply.getCode() != 0) {
            List<Long> createdIds = relaysToCreate.stream()
                    .map(TransparentRelay::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            if (!createdIds.isEmpty()) {
                this.removeByIds(createdIds);
            }
            return apply;
        }
        return R.ok(result);
    }

    @Override
    public R getAllRelays() {
        List<TransparentRelay> relays = this.list(new QueryWrapper<TransparentRelay>().orderByDesc("created_time"));
        List<TransparentRelayListDto> result = new ArrayList<>();
        for (TransparentRelay relay : relays) {
            TransparentRelayListDto dto = new TransparentRelayListDto();
            BeanUtils.copyProperties(relay, dto);
            Node node = nodeService.getNodeById(relay.getInNodeId());
            if (node != null) {
                dto.setInNodeName(node.getName());
                dto.setInNodeIp(node.getIp());
                dto.setInNodeServerIp(node.getServerIp());
            }
            dto.setRelayType("l4");
            result.add(dto);
        }
        appendProtocolRelayDtos(result, currentUserIdFromToken());
        return R.ok(result);
    }

    private void appendProtocolRelayDtos(List<TransparentRelayListDto> result, Long userId) {
        if (userId == null) {
            return;
        }
        List<Inbound> protocolRelays = collectProtocolRelayInbounds(inboundService.list(new QueryWrapper<Inbound>()
                .isNotNull("landing_id")
                .orderByDesc("created_time")));
        for (Inbound inbound : protocolRelays) {
            InboundUser inboundUser = inboundUserMapper.selectOne(new QueryWrapper<InboundUser>()
                    .eq("inbound_id", inbound.getId())
                    .eq("user_id", userId)
                    .isNotNull("gost_forward_id")
                    .and(status -> status.isNull("status").or().ne("status", STATUS_PAUSED))
                    .last("limit 1"));
            if (inboundUser == null) {
                continue;
            }
            Forward forward = forwardService.getById(inboundUser.getGostForwardId());
            if (forward == null) {
                continue;
            }
            TransparentRelayListDto dto = new TransparentRelayListDto();
            dto.setId(inbound.getId());
            dto.setInboundId(inbound.getId());
            dto.setLandingId(inbound.getLandingId());
            dto.setForwardId(forward.getId() == null ? null : forward.getId().longValue());
            dto.setName(inbound.getRemark() == null || inbound.getRemark().trim().isEmpty()
                    ? protocolDisplayName(inbound.getProtocol()) + " 协议中转"
                    : inbound.getRemark());
            dto.setRelayType("udp_quic");
            dto.setInNodeId(inbound.getNodeId());
            dto.setEntryPort(forward.getInPort());
            dto.setTargetPort(inbound.getListenPort());
            dto.setProtocol(inbound.getProtocol());
            dto.setMasquerade(false);
            dto.setStatus(inbound.getStatus());
            dto.setCreatedTime(inbound.getCreatedTime());
            dto.setUpdatedTime(inbound.getUpdatedTime());
            Node node = nodeService.getNodeById(inbound.getNodeId());
            if (node != null) {
                dto.setInNodeName(node.getName());
                dto.setInNodeIp(node.getIp());
                dto.setInNodeServerIp(node.getServerIp());
            }
            Landing landing = landingMapper.selectById(inbound.getLandingId());
            if (landing != null) {
                dto.setLandingName(landing.getName());
                dto.setTargetName(landing.getName());
                dto.setTargetHost(landing.getName());
            }
            result.add(dto);
        }
    }

    @Override
    public R updateRelay(TransparentRelayUpdateDto dto) {
        TransparentRelay existing = this.getById(dto.getId());
        if (existing == null) {
            return R.err("透明中转不存在");
        }
        Node node = dto.getInNodeId() == null ? null : nodeService.getNodeById(dto.getInNodeId());
        if (node == null) {
            return R.err("入口节点不存在");
        }
        Integer entryPort;
        try {
            entryPort = resolveEntryPort(node, dto.getEntryPort(), dto.getId());
        } catch (IllegalStateException e) {
            return R.err(e.getMessage());
        }
        R validation = validateRelayInput(dto.getName(), dto.getInNodeId(), entryPort, dto.getTargetHost(), dto.getTargetPort(), dto.getProtocol(), dto.getId());
        if (validation.getCode() != 0) {
            return validation;
        }

        Long oldNodeId = existing.getInNodeId();
        TransparentRelay updated = new TransparentRelay();
        BeanUtils.copyProperties(dto, updated);
        updated.setEntryPort(entryPort);
        updated.setProtocol(normalizeProtocol(dto.getProtocol()));
        updated.setTargetHost(dto.getTargetHost().trim());
        updated.setName(dto.getName().trim());
        updated.setMasquerade(true);
        updated.setStatus(STATUS_ACTIVE);
        updated.setLastError(null);
        updated.setUpdatedTime(System.currentTimeMillis());

        if (!this.updateById(updated)) {
            return R.err("透明中转更新失败");
        }

        R applyNew = applyNodeRelays(updated.getInNodeId());
        if (applyNew.getCode() != 0) {
            markRelayError(updated.getId(), applyNew.getMsg());
            return applyNew;
        }
        if (!Objects.equals(oldNodeId, updated.getInNodeId())) {
            R applyOld = applyNodeRelays(oldNodeId);
            if (applyOld.getCode() != 0) {
                return R.err("新入口已更新,但旧入口规则刷新失败: " + applyOld.getMsg());
            }
        }
        return R.ok("透明中转更新成功");
    }

    @Override
    public R deleteRelay(Long id) {
        TransparentRelay relay = this.getById(id);
        if (relay == null) {
            return R.err("透明中转不存在");
        }
        Long nodeId = relay.getInNodeId();
        if (!this.removeById(id)) {
            return R.err("透明中转删除失败");
        }
        R apply = applyNodeRelays(nodeId);
        if (apply.getCode() != 0) {
            return R.err("记录已删除,但节点规则刷新失败: " + apply.getMsg());
        }
        return R.ok("透明中转删除成功");
    }

    @Override
    public R pauseRelay(Long id) {
        return changeStatus(id, STATUS_PAUSED, "暂停");
    }

    @Override
    public R resumeRelay(Long id) {
        TransparentRelay relay = this.getById(id);
        if (relay == null) {
            return R.err("透明中转不存在");
        }
        R validation = validateRelayInput(relay.getName(), relay.getInNodeId(), relay.getEntryPort(), relay.getTargetHost(), relay.getTargetPort(), relay.getProtocol(), relay.getId());
        if (validation.getCode() != 0) {
            return validation;
        }
        return changeStatus(id, STATUS_ACTIVE, "恢复");
    }

    @Override
    public R getNodeStatus(TransparentRelayStatusDto dto) {
        Node node = nodeService.getNodeById(dto.getNodeId());
        if (node == null) {
            return R.err("入口节点不存在");
        }
        GostDto result = TransparentRelayUtil.GetTransparentRelayStatus(dto.getNodeId());
        if (!isGostOperationSuccess(result)) {
            return R.err(gostErrorMessage(result, "读取透明中转状态失败"));
        }
        return R.ok(result.getData());
    }

    @Override
    public R getSubscriptionLink(Long id) {
        TransparentRelay relay = this.getById(id);
        if (relay == null) {
            return R.err("透明中转不存在");
        }
        if (!Objects.equals(relay.getStatus(), STATUS_ACTIVE)) {
            return R.err("透明中转未启用,无法生成订阅链接");
        }
        try {
            String relayLink = buildL4RelayLink(relay, currentUserIdFromToken());
            return R.ok(new ForwardSubscriptionLinkResultDto(relayLink));
        } catch (IllegalArgumentException e) {
            return R.err(e.getMessage());
        } catch (Exception e) {
            log.error("生成透明中转{}订阅链接失败", id, e);
            return R.err("生成透明中转订阅链接失败,请稍后重试");
        }
    }

    @Override
    public R createSubscription() {
        Long userId = currentUserIdFromToken();
        if (userId == null) {
            return R.err("未登录");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            return R.err("用户不存在");
        }
        String token = ensureTransparentRelaySubToken(user);
        SubscriptionBuildResult result = buildSubscriptionLinksForUser(userId);
        return R.ok(new TransparentRelaySubscriptionResultDto(token, result.links.size(), result.skippedCount));
    }

    @Override
    public String buildSubscription(String token) {
        if (token == null || token.trim().isEmpty()) {
            return "";
        }
        User user = userMapper.selectOne(new QueryWrapper<User>()
                .eq("transparent_relay_sub_token", token.trim())
                .last("limit 1"));
        if (user == null) {
            return "";
        }
        return encodeSubscriptionLinks(buildSubscriptionLinksForUser(user.getId()).links);
    }

    private String buildL4RelayLink(TransparentRelay relay, Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("未登录");
        }
        Node ingressNode = nodeService.getNodeById(relay.getInNodeId());
        if (ingressNode == null) {
            throw new IllegalArgumentException("入口节点不存在");
        }
        Forward targetForward = findTargetForward(relay, userId);
        if (targetForward == null) {
            throw new IllegalArgumentException("目标端口没有匹配到当前用户已启用的协议转发");
        }
        String sourceLink = resolveForwardSourceLink(targetForward, userId);
        String endpointHost = ClientLinkUtil.resolveNodeEndpoint(ingressNode);
        String transitName = buildTransitSubscriptionName(ingressNode, relay.getProtocol(), sourceLink);
        return ClientLinkUtil.rewriteSourceLink(sourceLink, endpointHost, relay.getEntryPort(), transitName);
    }

    private String resolveForwardSourceLink(Forward forward, Long userId) {
        InboundUser managedUser = inboundUserMapper.selectOne(new QueryWrapper<InboundUser>()
                .eq("gost_forward_id", forward.getId())
                .eq("user_id", userId)
                .and(status -> status.isNull("status").or().ne("status", STATUS_PAUSED))
                .last("limit 1"));
        if (managedUser != null) {
            Inbound inbound = inboundService.getById(managedUser.getInboundId());
            if (inbound != null && !Objects.equals(inbound.getStatus(), STATUS_PAUSED)) {
                Node node = nodeService.getNodeById(inbound.getNodeId());
                if (node != null) {
                    return ClientLinkUtil.buildInboundLink(inbound, managedUser, node, forward);
                }
            }
        }
        String sourceLink = ClientLinkUtil.normalizeSourceLink(forward.getSourceLink());
        if (sourceLink == null || sourceLink.trim().isEmpty()) {
            throw new IllegalArgumentException("该转发未配置协议来源");
        }
        return sourceLink;
    }

    private String buildProtocolRelayLink(Inbound inbound, Long userId) {
        InboundUser inboundUser = inboundUserMapper.selectOne(new QueryWrapper<InboundUser>()
                .eq("inbound_id", inbound.getId())
                .eq("user_id", userId)
                .isNotNull("gost_forward_id")
                .and(status -> status.isNull("status").or().ne("status", STATUS_PAUSED))
                .last("limit 1"));
        if (inboundUser == null) {
            throw new IllegalArgumentException("当前用户未分配该协议中转");
        }
        Forward forward = forwardService.getById(inboundUser.getGostForwardId());
        if (forward == null || !Objects.equals(forward.getStatus(), STATUS_ACTIVE)) {
            throw new IllegalArgumentException("协议中转入口转发未启用");
        }
        Node ingressNode = nodeService.getNodeById(inbound.getNodeId());
        if (ingressNode == null) {
            throw new IllegalArgumentException("入口节点不存在");
        }
        String transitName = buildTransitSubscriptionName(ingressNode, inbound.getProtocol());
        return ClientLinkUtil.buildInboundLink(inbound, inboundUser, ingressNode, forward, transitName, true);
    }

    private SubscriptionBuildResult buildSubscriptionLinksForUser(Long userId) {
        SubscriptionBuildResult result = new SubscriptionBuildResult();
        List<TransparentRelay> activeL4Relays = this.list(new QueryWrapper<TransparentRelay>()
                .eq("status", STATUS_ACTIVE)
                .orderByAsc("entry_port"));
        for (TransparentRelay relay : activeL4Relays) {
            try {
                result.links.add(buildL4RelayLink(relay, userId));
            } catch (Exception e) {
                result.skippedCount++;
                log.debug("透明中转{}未加入聚合订阅: {}", relay.getId(), e.getMessage());
            }
        }
        List<Inbound> protocolRelays = collectProtocolRelayInbounds(inboundService.list(new QueryWrapper<Inbound>()
                .isNotNull("landing_id")
                .orderByAsc("node_id")
                .orderByAsc("listen_port")));
        for (Inbound inbound : protocolRelays) {
            try {
                result.links.add(buildProtocolRelayLink(inbound, userId));
            } catch (Exception e) {
                result.skippedCount++;
                log.debug("协议中转{}未加入透明中转聚合订阅: {}", inbound.getId(), e.getMessage());
            }
        }
        return result;
    }

    List<Inbound> collectProtocolRelayInbounds(List<Inbound> inbounds) {
        if (inbounds == null) {
            return new ArrayList<>();
        }
        return inbounds.stream()
                .filter(inbound -> inbound.getLandingId() != null)
                .filter(inbound -> !Objects.equals(inbound.getStatus(), STATUS_PAUSED))
                .filter(inbound -> isUdpQuicProxyProtocol(inbound.getProtocol()))
                .collect(Collectors.toList());
    }

    String encodeSubscriptionLinks(List<String> links) {
        String joined = String.join("\n", links == null ? new ArrayList<>() : links);
        return Base64.getEncoder().encodeToString(joined.getBytes(StandardCharsets.UTF_8));
    }

    private String ensureTransparentRelaySubToken(User user) {
        if (user.getTransparentRelaySubToken() != null && !user.getTransparentRelaySubToken().trim().isEmpty()) {
            return user.getTransparentRelaySubToken();
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        user.setTransparentRelaySubToken(token);
        userMapper.updateById(user);
        return token;
    }

    private static class SubscriptionBuildResult {
        private final List<String> links = new ArrayList<>();
        private int skippedCount;
    }

    private Forward findTargetForward(TransparentRelay relay, Long userId) {
        Node targetNode = findTargetNode(relay.getTargetHost());
        if (targetNode == null) {
            return null;
        }
        List<Tunnel> tunnels = tunnelService.list(new QueryWrapper<Tunnel>().eq("in_node_id", targetNode.getId()));
        List<Integer> tunnelIds = tunnels.stream()
                .map(Tunnel::getId)
                .filter(Objects::nonNull)
                .map(Long::intValue)
                .collect(Collectors.toList());
        if (tunnelIds.isEmpty()) {
            return null;
        }
        QueryWrapper<Forward> query = new QueryWrapper<Forward>()
                .in("tunnel_id", tunnelIds)
                .eq("in_port", relay.getTargetPort())
                .eq("status", STATUS_ACTIVE);
        if (userId != null) {
            query.eq("user_id", userId.intValue());
        }
        return forwardService.getOne(query.last("limit 1"));
    }

    private List<Forward> findTargetForwardCandidates(Long targetNodeId, Long userId) {
        List<Tunnel> tunnels = tunnelService.list(new QueryWrapper<Tunnel>().eq("in_node_id", targetNodeId));
        List<Integer> tunnelIds = tunnels.stream()
                .map(Tunnel::getId)
                .filter(Objects::nonNull)
                .map(Long::intValue)
                .collect(Collectors.toList());
        if (tunnelIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<Forward> forwards = forwardService.list(new QueryWrapper<Forward>()
                .in("tunnel_id", tunnelIds)
                .eq("status", STATUS_ACTIVE)
                .orderByAsc("in_port"));
        return collectBatchTargetForwards(forwards, userId);
    }

    List<Forward> collectBatchTargetForwards(List<Forward> forwards) {
        return collectBatchTargetForwards(forwards, null);
    }

    List<Forward> collectBatchTargetForwards(List<Forward> forwards, Long userId) {
        Map<Integer, Forward> byPort = new LinkedHashMap<>();
        forwards.stream()
                .filter(forward -> Objects.equals(forward.getStatus(), STATUS_ACTIVE))
                .filter(forward -> forward.getInPort() != null)
                .filter(forward -> userId == null || Objects.equals(forwardUserId(forward), userId))
                .sorted((a, b) -> a.getInPort().compareTo(b.getInPort()))
                .forEach(forward -> byPort.putIfAbsent(forward.getInPort(), forward));
        return new ArrayList<>(byPort.values());
    }

    private Long forwardUserId(Forward forward) {
        return forward.getUserId() == null ? null : forward.getUserId().longValue();
    }

    private Long currentUserIdFromToken() {
        Integer userId = JwtUtil.getUserIdFromToken();
        return userId == null ? null : userId.longValue();
    }

    private boolean hasExistingTargetRelay(Long inNodeId, String targetHost, Integer targetPort, String protocol) {
        List<TransparentRelay> existingRelays = this.list(new QueryWrapper<TransparentRelay>()
                .eq("in_node_id", inNodeId)
                .eq("target_host", targetHost)
                .eq("target_port", targetPort));
        String normalizedProtocol = normalizeProtocol(protocol);
        for (TransparentRelay relay : existingRelays) {
            if (protocolsOverlap(normalizedProtocol, relay.getProtocol())) {
                return true;
            }
        }
        return false;
    }

    String buildBatchRelayName(Node ingressNode, Node targetNode, Forward forward, String protocolName) {
        String ingressName = readableNodeName(ingressNode);
        String targetName = readableNodeName(targetNode);
        String descriptor = protocolName == null || protocolName.trim().isEmpty()
                ? fallbackForwardName(forward)
                : protocolName.trim();
        return truncate(ingressName + " -> " + targetName + " " + descriptor + " " + forward.getInPort(), 100);
    }

    private String fallbackForwardName(Forward forward) {
        if (forward.getName() == null || forward.getName().trim().isEmpty()) {
            return "端口";
        }
        return forward.getName().trim();
    }

    private String resolveForwardProtocolLabel(Long targetNodeId, Forward forward) {
        String protocol = resolveForwardProtocolValue(targetNodeId, forward);
        return protocol == null ? null : protocolDisplayName(protocol);
    }

    String resolveForwardProtocolValue(Long targetNodeId, Forward forward) {
        Set<Integer> remotePorts = extractRemotePorts(forward.getRemoteAddr());
        if (remotePorts.isEmpty()) {
            return null;
        }
        List<Inbound> inbounds = inboundService.list(new QueryWrapper<Inbound>()
                .eq("node_id", targetNodeId)
                .in("listen_port", remotePorts)
                .ne("status", STATUS_PAUSED));
        if (inbounds.isEmpty()) {
            return null;
        }
        return inbounds.get(0).getProtocol();
    }

    boolean isUdpQuicProxyProtocol(String protocol) {
        if (protocol == null || protocol.trim().isEmpty()) {
            return false;
        }
        String normalized = protocol.trim().toLowerCase(Locale.ROOT);
        return "hysteria2".equals(normalized) || "tuic".equals(normalized);
    }

    Set<Integer> extractRemotePorts(String remoteAddr) {
        Set<Integer> ports = new HashSet<>();
        if (remoteAddr == null || remoteAddr.trim().isEmpty()) {
            return ports;
        }
        for (String part : remoteAddr.split(",")) {
            String addr = part.trim();
            int separator = addr.lastIndexOf(':');
            if (separator < 0 || separator == addr.length() - 1) {
                continue;
            }
            try {
                ports.add(Integer.parseInt(addr.substring(separator + 1)));
            } catch (NumberFormatException ignored) {
                // Ignore malformed remote address fragments.
            }
        }
        return ports;
    }

    String buildTransitSubscriptionName(Node ingressNode, String protocol) {
        return buildTransitSubscriptionName(ingressNode, protocol, null);
    }

    String buildTransitSubscriptionName(Node ingressNode, String fallbackProtocol, String clientLink) {
        String countryCode = ingressCountryCode(ingressNode);
        String prefix = countryFlag(countryCode) + " " + countryCode;
        String protocolName = protocolDisplayName(resolveClientLinkProtocol(clientLink, fallbackProtocol));
        if (protocolName == null || protocolName.trim().isEmpty() || isL4TransportProtocol(protocolName)) {
            protocolName = "Proxy";
        }
        return prefix + " " + protocolName + " Transit";
    }

    private String resolveClientLinkProtocol(String clientLink, String fallbackProtocol) {
        if (clientLink != null) {
            int separator = clientLink.indexOf("://");
            if (separator > 0) {
                String scheme = clientLink.substring(0, separator).trim().toLowerCase(Locale.ROOT);
                if (!scheme.isEmpty()) {
                    return scheme;
                }
            }
        }
        return fallbackProtocol;
    }

    private boolean isL4TransportProtocol(String protocolName) {
        if (protocolName == null) {
            return false;
        }
        String normalized = protocolName.trim().toLowerCase(Locale.ROOT);
        return "tcp".equals(normalized) || "udp".equals(normalized) || "tcp_udp".equals(normalized)
                || "tcp+udp".equals(normalized);
    }

    private String ingressCountryCode(Node ingressNode) {
        if (ingressNode != null && ingressNode.getCountry() != null) {
            String country = ingressNode.getCountry().trim().toUpperCase(Locale.ROOT);
            if (country.matches("[A-Z]{2}")) {
                return country;
            }
        }
        return "JP";
    }

    private String countryFlag(String countryCode) {
        if (countryCode == null || !countryCode.matches("[A-Z]{2}")) {
            return "🏳️";
        }
        return new String(Character.toChars(0x1F1E6 + countryCode.charAt(0) - 'A'))
                + new String(Character.toChars(0x1F1E6 + countryCode.charAt(1) - 'A'));
    }

    String protocolDisplayName(String protocol) {
        if (protocol == null || protocol.trim().isEmpty()) {
            return null;
        }
        switch (protocol.trim().toLowerCase(Locale.ROOT)) {
            case "vless":
                return "VLESS";
            case "trojan":
                return "Trojan";
            case "vmess":
                return "VMess";
            case "shadowsocks":
                return "SS-2022";
            case "hysteria2":
                return "Hysteria2";
            case "tuic":
                return "TUIC";
            case "anytls":
                return "AnyTLS";
            default:
                return protocol.trim();
        }
    }

    private String readableNodeName(Node node) {
        if (node.getName() != null && !node.getName().trim().isEmpty()) {
            return node.getName().trim();
        }
        return "节点" + node.getId();
    }

    private Node findTargetNode(String targetHost) {
        String target = targetHost == null ? "" : targetHost.trim();
        if (target.isEmpty()) {
            return null;
        }
        for (Node node : nodeService.list()) {
            if (nodeHasHost(node, target)) {
                return node;
            }
        }
        return null;
    }

    private boolean nodeHasHost(Node node, String target) {
        return hostListContains(node.getServerIp(), target)
                || hostListContains(node.getIp(), target)
                || hostListContains(node.getDomain(), target);
    }

    private boolean hostListContains(String hosts, String target) {
        if (hosts == null) {
            return false;
        }
        for (String host : hosts.split(",")) {
            if (target.equals(host.trim())) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private String extractForwardLink(Object data) {
        if (data instanceof ForwardSubscriptionLinkResultDto) {
            return ((ForwardSubscriptionLinkResultDto) data).getLink();
        }
        if (data instanceof Map) {
            Object link = ((Map<String, Object>) data).get("link");
            return link == null ? null : link.toString();
        }
        return null;
    }

    private R changeStatus(Long id, int status, String operation) {
        TransparentRelay relay = this.getById(id);
        if (relay == null) {
            return R.err("透明中转不存在");
        }
        relay.setStatus(status);
        relay.setLastError(null);
        relay.setUpdatedTime(System.currentTimeMillis());
        if (!this.updateById(relay)) {
            return R.err("透明中转" + operation + "失败");
        }
        R apply = applyNodeRelays(relay.getInNodeId());
        if (apply.getCode() != 0) {
            if (status == STATUS_ACTIVE) {
                markRelayError(id, apply.getMsg());
            }
            return apply;
        }
        return R.ok("透明中转已" + operation);
    }

    private R applyNodeRelays(Long nodeId) {
        Node node = nodeService.getNodeById(nodeId);
        if (node == null) {
            return R.err("入口节点不存在");
        }
        List<TransparentRelay> activeRelays = this.list(new QueryWrapper<TransparentRelay>()
                .eq("in_node_id", nodeId)
                .eq("status", STATUS_ACTIVE)
                .orderByAsc("entry_port"));
        GostDto result = TransparentRelayUtil.SetTransparentRelays(nodeId, activeRelays);
        if (!isGostOperationSuccess(result)) {
            String msg = gostErrorMessage(result, "透明中转规则下发失败");
            log.info("节点{}透明中转规则应用失败: {}", nodeId, msg);
            return R.err(msg);
        }
        keepNodeActiveErrorsClean(nodeId);
        return R.ok();
    }

    private void keepNodeActiveErrorsClean(Long nodeId) {
        List<TransparentRelay> activeRelays = this.list(new QueryWrapper<TransparentRelay>()
                .eq("in_node_id", nodeId)
                .eq("status", STATUS_ACTIVE)
                .isNotNull("last_error"));
        for (TransparentRelay relay : activeRelays) {
            relay.setLastError(null);
            relay.setUpdatedTime(System.currentTimeMillis());
        }
        if (!activeRelays.isEmpty()) {
            this.updateBatchById(activeRelays);
        }
    }

    private void markRelayError(Long id, String error) {
        TransparentRelay relay = new TransparentRelay();
        relay.setId(id);
        relay.setStatus(STATUS_ERROR);
        relay.setLastError(truncate(error, 512));
        relay.setUpdatedTime(System.currentTimeMillis());
        this.updateById(relay);
    }

    private Integer resolveEntryPort(Node node, Integer requestedPort, Long excludeId) {
        if (requestedPort != null) {
            return requestedPort;
        }
        Set<Integer> occupiedPorts = collectOccupiedEntryPorts(node.getId(), excludeId);
        return pickAvailableEntryPort(node, occupiedPorts, new Random());
    }

    private Set<Integer> collectOccupiedEntryPorts(Long nodeId, Long excludeId) {
        Set<Integer> occupiedPorts = new HashSet<>();

        QueryWrapper<TransparentRelay> relayWrapper = new QueryWrapper<TransparentRelay>()
                .eq("in_node_id", nodeId);
        if (excludeId != null) {
            relayWrapper.ne("id", excludeId);
        }
        for (TransparentRelay relay : this.list(relayWrapper)) {
            if (relay.getEntryPort() != null) {
                occupiedPorts.add(relay.getEntryPort());
            }
        }

        if (tunnelService != null && forwardService != null) {
            List<Tunnel> tunnels = tunnelService.list(new QueryWrapper<Tunnel>().eq("in_node_id", nodeId));
            List<Integer> tunnelIds = tunnels.stream()
                    .map(Tunnel::getId)
                    .filter(Objects::nonNull)
                    .map(Long::intValue)
                    .collect(Collectors.toList());
            if (!tunnelIds.isEmpty()) {
                List<Forward> forwards = forwardService.list(new QueryWrapper<Forward>().in("tunnel_id", tunnelIds));
                for (Forward forward : forwards) {
                    if (forward.getInPort() != null) {
                        occupiedPorts.add(forward.getInPort());
                    }
                }
            }
        }

        return occupiedPorts;
    }

    int pickAvailableEntryPort(Node node, Set<Integer> occupiedPorts, Random random) {
        int start = node.getPortSta() == null ? 10000 : node.getPortSta();
        int end = node.getPortEnd() == null ? 65535 : node.getPortEnd();
        start = Math.max(1, start);
        end = Math.min(65535, end);
        if (end >= 10000 && start < 10000) {
            start = 10000;
        }
        if (start > end) {
            throw new IllegalStateException("入口节点端口范围无效,无法自动分配端口");
        }

        int range = end - start + 1;
        if (occupiedPorts.size() >= range) {
            throw new IllegalStateException("入口节点端口范围内已无可用端口");
        }
        int offset = random.nextInt(range);
        for (int i = 0; i < range; i++) {
            int port = start + ((offset + i) % range);
            if (!occupiedPorts.contains(port)) {
                return port;
            }
        }
        throw new IllegalStateException("入口节点端口范围内已无可用端口");
    }

    private R validateRelayInput(String name, Long inNodeId, Integer entryPort, String targetHost, Integer targetPort, String protocol, Long excludeId) {
        if (name == null || name.trim().isEmpty()) {
            return R.err("规则名称不能为空");
        }
        if (inNodeId == null || nodeService.getNodeById(inNodeId) == null) {
            return R.err("入口节点不存在");
        }
        if (!isValidPort(entryPort)) {
            return R.err("入口端口必须在1-65535范围内");
        }
        if (!isValidPort(targetPort)) {
            return R.err("目标端口必须在1-65535范围内");
        }
        String normalizedProtocol = normalizeProtocol(protocol);
        if (!SUPPORTED_PROTOCOLS.contains(normalizedProtocol)) {
            return R.err("协议只支持 tcp、udp、tcp_udp");
        }
        if (targetHost == null || targetHost.trim().isEmpty()) {
            return R.err("目标地址不能为空");
        }
        if (isLoopbackTarget(targetHost.trim())) {
            return R.err("透明中转目标不能填写127.0.0.1/localhost,请填写入口机可访问的主服务器地址");
        }
        if (!isIpv4Target(targetHost.trim())) {
            return R.err("第一版透明中转目标地址只支持IPv4,请填写主服务器公网IP或WireGuard IPv4");
        }
        QueryWrapper<TransparentRelay> duplicate = new QueryWrapper<TransparentRelay>()
                .eq("in_node_id", inNodeId)
                .eq("entry_port", entryPort);
        if (excludeId != null) {
            duplicate.ne("id", excludeId);
        }
        List<TransparentRelay> samePortRelays = this.list(duplicate);
        for (TransparentRelay relay : samePortRelays) {
            if (protocolsOverlap(normalizedProtocol, relay.getProtocol())) {
                return R.err("该入口节点上已存在会占用同一端口的透明中转协议");
            }
        }
        return R.ok();
    }

    private boolean protocolsOverlap(String left, String right) {
        String a = normalizeProtocol(left);
        String b = normalizeProtocol(right);
        if ("tcp_udp".equals(a) || "tcp_udp".equals(b)) {
            return true;
        }
        return Objects.equals(a, b);
    }

    private boolean isValidPort(Integer port) {
        return port != null && port >= 1 && port <= 65535;
    }

    private String normalizeProtocol(String protocol) {
        return protocol == null ? "" : protocol.trim().toLowerCase(Locale.ROOT).replace('-', '_');
    }

    private boolean isLoopbackTarget(String host) {
        String h = host.trim().toLowerCase(Locale.ROOT);
        return "localhost".equals(h) || "127.0.0.1".equals(h) || "::1".equals(h)
                || h.startsWith("127.") || "[::1]".equals(h);
    }

    private boolean isIpv4Target(String host) {
        String[] parts = host.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        for (String part : parts) {
            try {
                if (part.isEmpty() || (part.length() > 1 && part.startsWith("0"))) {
                    return false;
                }
                int n = Integer.parseInt(part);
                if (n < 0 || n > 255) {
                    return false;
                }
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return true;
    }

    private boolean isGostOperationSuccess(GostDto result) {
        return result != null && GOST_SUCCESS_MSG.equals(result.getMsg());
    }

    private String gostErrorMessage(GostDto result, String fallback) {
        if (result == null || result.getMsg() == null || result.getMsg().trim().isEmpty()) {
            return fallback;
        }
        return result.getMsg();
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
