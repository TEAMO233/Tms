package com.admin.service.impl;

import com.admin.entity.Forward;
import com.admin.entity.Inbound;
import com.admin.entity.Node;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TransparentRelayServiceImplTest {

    @Test
    void autoPortUsesConfiguredRangeAndSkipsOccupiedPorts() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node node = new Node();
        node.setPortSta(10000);
        node.setPortEnd(10002);
        Set<Integer> occupied = new HashSet<>();
        occupied.add(10000);
        occupied.add(10001);

        int port = service.pickAvailableEntryPort(node, occupied, new Random(0));

        assertEquals(10002, port);
    }

    @Test
    void autoPortPrefersHighPortsWhenNodeRangeStartsLow() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node node = new Node();
        node.setPortSta(1000);
        node.setPortEnd(10002);
        Set<Integer> occupied = new HashSet<>();
        occupied.add(10001);
        occupied.add(10002);

        int port = service.pickAvailableEntryPort(node, occupied, new Random(0));

        assertEquals(10000, port);
    }

    @Test
    void autoPortFailsWhenNoPortAvailable() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node node = new Node();
        node.setPortSta(10000);
        node.setPortEnd(10001);
        Set<Integer> occupied = new HashSet<>();
        occupied.add(10000);
        occupied.add(10001);

        assertThrows(IllegalStateException.class, () -> service.pickAvailableEntryPort(node, occupied, new Random(0)));
    }

    @Test
    void batchTargetForwardsUseActiveUniquePortsInOrder() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        List<Forward> forwards = Arrays.asList(
                forward(1, 20002, 1, "TUIC"),
                forward(1, 20000, 1, "HY2"),
                forward(1, 20000, 1, "HY2 duplicate"),
                forward(1, 20001, 0, "paused"),
                forward(1, null, 1, "broken")
        );

        List<Integer> ports = service.collectBatchTargetForwards(forwards).stream()
                .map(Forward::getInPort)
                .collect(Collectors.toList());

        assertEquals(Arrays.asList(20000, 20002), ports);
    }

    @Test
    void batchTargetForwardsCanBeScopedToCurrentUser() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        List<Forward> forwards = Arrays.asList(
                forward(1, 20006, 1, "u1-vless", 1),
                forward(1, 20007, 1, "u1-trojan", 1),
                forward(1, 20012, 1, "u3-vless", 3),
                forward(1, 20013, 1, "u3-trojan", 3)
        );

        List<Integer> ports = service.collectBatchTargetForwards(forwards, 1L).stream()
                .map(Forward::getInPort)
                .collect(Collectors.toList());

        assertEquals(Arrays.asList(20006, 20007), ports);
    }

    @Test
    void udpQuicProxyProtocolsAreSkippedFromL4Batch() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();

        assertEquals(true, service.isUdpQuicProxyProtocol("hysteria2"));
        assertEquals(true, service.isUdpQuicProxyProtocol("TUIC"));
        assertEquals(false, service.isUdpQuicProxyProtocol("vless"));
    }

    @Test
    void batchRelayNameUsesProtocolLabelAfterTargetNodeName() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node ingress = node(2L, "vmiss日本");
        Node target = node(1L, "本机");
        Forward forward = forward(1, 20000, 1, "inbound-13-user-1");

        String name = service.buildBatchRelayName(ingress, target, forward, "Hysteria2");

        assertEquals("vmiss日本 -> 本机 Hysteria2 20000", name);
    }

    @Test
    void remotePortParserReadsPortsFromCommaSeparatedTargets() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();

        Set<Integer> ports = service.extractRemotePorts("127.0.0.1:40013, 10.0.0.1:40100");

        assertEquals(new HashSet<>(Arrays.asList(40013, 40100)), ports);
    }

    @Test
    void protocolRelayInboundsUseOnlyActiveUdpQuicLandingInbounds() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        List<Inbound> inbounds = Arrays.asList(
                inbound(1L, "hysteria2", 1, 10L),
                inbound(2L, "tuic", 1, 11L),
                inbound(3L, "vless", 1, 12L),
                inbound(4L, "hysteria2", 0, 13L),
                inbound(5L, "tuic", 1, null)
        );

        List<Long> ids = service.collectProtocolRelayInbounds(inbounds).stream()
                .map(Inbound::getId)
                .collect(Collectors.toList());

        assertEquals(Arrays.asList(1L, 2L), ids);
    }

    @Test
    void transparentRelaySubscriptionEncodesAllLinksAsOneBase64Body() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();

        String encoded = service.encodeSubscriptionLinks(Arrays.asList("vless://one", "hysteria2://two"));
        String decoded = new String(java.util.Base64.getDecoder().decode(encoded), java.nio.charset.StandardCharsets.UTF_8);

        assertEquals("vless://one\nhysteria2://two", decoded);
    }

    @Test
    void transitSubscriptionNameUsesIngressCountryAndProtocol() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node ingress = node(2L, "vmiss日本");
        ingress.setCountry("JP");

        assertEquals("🇯🇵 JP VLESS Transit", service.buildTransitSubscriptionName(ingress, "vless"));
        assertEquals("🇯🇵 JP Hysteria2 Transit", service.buildTransitSubscriptionName(ingress, "hysteria2"));
        assertEquals("🇯🇵 JP TUIC Transit", service.buildTransitSubscriptionName(ingress, "tuic"));
    }

    @Test
    void transitSubscriptionNameCanUseActualClientLinkProtocolInsteadOfL4Transport() {
        TransparentRelayServiceImpl service = new TransparentRelayServiceImpl();
        Node ingress = node(2L, "vmiss日本");
        ingress.setCountry("JP");

        assertEquals("🇯🇵 JP VLESS Transit",
                service.buildTransitSubscriptionName(ingress, "tcp_udp", "vless://uuid@example.com:443#old"));
        assertEquals("🇯🇵 JP Trojan Transit",
                service.buildTransitSubscriptionName(ingress, "tcp_udp", "trojan://password@example.com:443#old"));
        assertEquals("🇯🇵 JP VMess Transit",
                service.buildTransitSubscriptionName(ingress, "tcp_udp", "vmess://eyJhZGQiOiJzZyIsInBvcnQiOjQ0MywiaWQiOiJ1dWlkIiwicHMiOiJvbGQifQ=="));
        assertEquals("🇯🇵 JP AnyTLS Transit",
                service.buildTransitSubscriptionName(ingress, "tcp_udp", "anytls://password@example.com:443#old"));
    }

    private Node node(Long id, String name) {
        Node node = new Node();
        node.setId(id);
        node.setName(name);
        return node;
    }

    private Inbound inbound(Long id, String protocol, Integer status, Long landingId) {
        Inbound inbound = new Inbound();
        inbound.setId(id);
        inbound.setProtocol(protocol);
        inbound.setStatus(status);
        inbound.setLandingId(landingId);
        return inbound;
    }

    private Forward forward(Integer tunnelId, Integer inPort, Integer status, String name) {
        return forward(tunnelId, inPort, status, name, null);
    }

    private Forward forward(Integer tunnelId, Integer inPort, Integer status, String name, Integer userId) {
        Forward forward = new Forward();
        forward.setTunnelId(tunnelId);
        forward.setInPort(inPort);
        forward.setStatus(status);
        forward.setName(name);
        forward.setUserId(userId);
        return forward;
    }
}
