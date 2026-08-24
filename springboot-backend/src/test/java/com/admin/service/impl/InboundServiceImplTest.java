package com.admin.service.impl;

import com.admin.entity.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InboundServiceImplTest {

    @Test
    void udpQuicProtocolValidationAcceptsOnlyHysteria2AndTuic() {
        InboundServiceImpl service = new InboundServiceImpl();

        assertTrue(service.isUdpQuicProtocol("hysteria2"));
        assertTrue(service.isUdpQuicProtocol("tuic"));
        assertTrue(service.isUdpQuicProtocol("Hysteria2"));
        assertFalse(service.isUdpQuicProtocol("hy2"));
        assertFalse(service.isUdpQuicProtocol("vless"));
    }

    @Test
    void relayLandingMarkerIsDeterministicAndLowercase() {
        InboundServiceImpl service = new InboundServiceImpl();

        assertEquals("udp-quic-relay:2:1:tuic", service.relayLandingMarker(2L, 1L, "TUIC"));
    }

    @Test
    void relayInboundRemarkUsesNodeNamesAndProtocolDisplayNames() {
        InboundServiceImpl service = new InboundServiceImpl();
        Node ingress = node(2L, "vmiss日本");
        Node target = node(1L, "本机");

        assertEquals("vmiss日本 -> 本机 Hysteria2 协议中转", service.relayInboundRemark(ingress, target, "hysteria2"));
        assertEquals("vmiss日本 -> 本机 TUIC 协议中转", service.relayInboundRemark(ingress, target, "tuic"));
    }

    private Node node(Long id, String name) {
        Node node = new Node();
        node.setId(id);
        node.setName(name);
        return node;
    }
}
