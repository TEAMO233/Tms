package com.admin.common.utils;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LandingUtilTest {

    @Test
    void parseTuicLinkBuildsSingBoxOutbound() {
        String link = "tuic://0189e240-2953-7ff6-8b08-581f0ac4f54f:p%40ss%3Aword@example.com:443"
                + "?congestion_control=bbr&alpn=h3&sni=sg.example.com&allow_insecure=1#sg-tuic";

        LandingUtil.Parsed parsed = LandingUtil.parse(link);
        JSONObject outbound = parsed.outbound;
        JSONObject tls = outbound.getJSONObject("tls");
        JSONArray alpn = tls.getJSONArray("alpn");

        assertEquals("tuic", parsed.type);
        assertEquals("tuic", outbound.getString("type"));
        assertEquals("example.com", outbound.getString("server"));
        assertEquals(443, outbound.getIntValue("server_port"));
        assertEquals("0189e240-2953-7ff6-8b08-581f0ac4f54f", outbound.getString("uuid"));
        assertEquals("p@ss:word", outbound.getString("password"));
        assertEquals("bbr", outbound.getString("congestion_control"));
        assertEquals("native", outbound.getString("udp_relay_mode"));
        assertTrue(tls.getBooleanValue("enabled"));
        assertTrue(tls.getBooleanValue("insecure"));
        assertEquals("sg.example.com", tls.getString("server_name"));
        assertEquals("h3", alpn.getString(0));
    }

    @Test
    void parseTuicDefaultsQuicFieldsForTmsGeneratedLinks() {
        String link = "tuic://0189e240-2953-7ff6-8b08-581f0ac4f54f:secret@example.com:8443?sni=sg.example.com";

        JSONObject outbound = LandingUtil.parse(link).outbound;
        JSONObject tls = outbound.getJSONObject("tls");

        assertEquals("bbr", outbound.getString("congestion_control"));
        assertEquals("native", outbound.getString("udp_relay_mode"));
        assertEquals("h3", tls.getJSONArray("alpn").getString(0));
    }
}
