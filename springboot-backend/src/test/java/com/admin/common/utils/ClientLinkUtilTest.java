package com.admin.common.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClientLinkUtilTest {

    @Test
    void rewriteSourceLinkReplacesUriFragmentName() {
        String source = "vless://00000000-0000-0000-0000-000000000000@sg.example.com:443?security=reality&sni=old.example#%F0%9F%87%B8%F0%9F%87%AC%20SG%20VLESS";

        String rewritten = ClientLinkUtil.rewriteSourceLink(
                source,
                "64.83.37.138",
                32445,
                "vmiss日本 -> 本机 VLESS 20006");

        assertTrue(rewritten.startsWith("vless://00000000-0000-0000-0000-000000000000@64.83.37.138:32445?"));
        assertTrue(rewritten.contains("security=reality&sni=old.example"));
        assertTrue(rewritten.endsWith("#vmiss%E6%97%A5%E6%9C%AC%20-%3E%20%E6%9C%AC%E6%9C%BA%20VLESS%2020006"));
    }

    @Test
    void rewriteSourceLinkAddsUriFragmentNameWhenMissing() {
        String source = "trojan://password@sg.example.com:443?security=reality&sni=old.example";

        String rewritten = ClientLinkUtil.rewriteSourceLink(
                source,
                "64.83.37.138",
                22102,
                "vmiss日本 -> 本机 Trojan 20007");

        assertEquals(
                "trojan://password@64.83.37.138:22102?security=reality&sni=old.example#vmiss%E6%97%A5%E6%9C%AC%20-%3E%20%E6%9C%AC%E6%9C%BA%20Trojan%2020007",
                rewritten);
    }
}
