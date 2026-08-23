package com.admin.common.utils;

import com.admin.entity.Forward;
import com.admin.entity.Inbound;
import com.admin.entity.InboundUser;
import com.admin.entity.Node;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 客户端协议链接的唯一拼装入口。
 *
 * 自动协议转发和手工转发的来源不同,但最终都只需要把客户端 endpoint 指向
 * Gost 入口。这里把协议格式、原始 URI 的最小改写和 VMess JSON 的特殊处理
 * 放在一起,避免订阅链路和协议分配链路各自维护一套容易漂移的规则。
 */
public final class ClientLinkUtil {

    private static final Set<String> SOURCE_SCHEMES;

    static {
        Set<String> schemes = new HashSet<>();
        Collections.addAll(schemes, "vless", "vmess", "trojan", "hysteria2", "hy2",
                "tuic", "anytls", "ss");
        SOURCE_SCHEMES = Collections.unmodifiableSet(schemes);
    }

    private ClientLinkUtil() {
    }

    /** 空值代表没有手工来源;保存前统一把空白压成 null。 */
    public static String normalizeSourceLink(String sourceLink) {
        if (sourceLink == null) {
            return null;
        }
        String normalized = sourceLink.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    /**
     * 校验单条来源链接的格式,不返回或记录完整凭证。
     *
     * @return null 表示校验通过,否则返回可直接展示给用户的中文错误
     */
    public static String validateSourceLink(String sourceLink) {
        String source = normalizeSourceLink(sourceLink);
        if (source == null) {
            return null;
        }
        if (containsLineBreak(source)) {
            return "协议链接不能包含换行";
        }

        int schemeSeparator = source.indexOf("://");
        if (schemeSeparator <= 0 || schemeSeparator + 3 >= source.length()) {
            return "协议链接格式不正确";
        }
        String scheme = source.substring(0, schemeSeparator).toLowerCase(Locale.ROOT);
        if (!SOURCE_SCHEMES.contains(scheme)) {
            return "暂不支持该协议链接";
        }
        if ("vmess".equals(scheme)) {
            try {
                parseVmess(source, schemeSeparator);
                return null;
            } catch (IllegalArgumentException e) {
                return e.getMessage();
            }
        }

        if ("ss".equals(scheme)) {
            try {
                parseUriSource(source, schemeSeparator);
                return null;
            } catch (IllegalArgumentException modernError) {
                try {
                    validateLegacyShadowsocks(source, schemeSeparator);
                    return null;
                } catch (IllegalArgumentException legacyError) {
                    return legacyError.getMessage();
                }
            }
        }

        try {
            parseUriSource(source, schemeSeparator);
            return null;
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    /**
     * 根据入站凭证生成自动协议转发链接。输出格式继续复用 SingboxUtil,
     * 所以已有「我的订阅」与新转发订阅不会出现协议参数分叉。
     */
    public static String buildInboundLink(Inbound inbound, InboundUser inboundUser,
                                          Node node, Forward forward) {
        return buildInboundLink(inbound, inboundUser, node, forward, "");
    }

    /** namePrefix 仅用于现有聚合订阅的线路名称前缀。 */
    public static String buildInboundLink(Inbound inbound, InboundUser inboundUser,
                                          Node node, Forward forward, String namePrefix) {
        if (inbound == null || inboundUser == null || node == null || forward == null) {
            throw new IllegalArgumentException("协议来源信息不完整");
        }
        if (forward.getInPort() == null) {
            throw new IllegalArgumentException("转发入口端口不存在");
        }

        String endpointHost = resolveNodeEndpoint(node);
        String protocol = inbound.getProtocol() == null
                ? "" : inbound.getProtocol().toLowerCase(Locale.ROOT);
        String remark = buildRemark(inbound, node, namePrefix);
        String uuid = inboundUser.getUuid();
        String password = inboundUser.getPassword();

        switch (protocol) {
            case "shadowsocks": {
                JSONObject config = parseConfig(inbound.getConfigJson());
                String method = config.getString("method");
                String configPassword = config.getString("password");
                if (method == null || method.isEmpty() || configPassword == null || configPassword.isEmpty()) {
                    throw new IllegalArgumentException("Shadowsocks 协议配置不完整");
                }
                return SingboxUtil.buildShadowsocksLink(endpointHost, forward.getInPort(),
                        method, configPassword, remark);
            }
            case "vmess":
                requireCredential(uuid, "VMess");
                return SingboxUtil.buildVmessLink(uuid, endpointHost, forward.getInPort(), remark);
            case "trojan":
                requireCredential(password, "Trojan");
                return SingboxUtil.buildTrojanRealityLink(password, endpointHost, forward.getInPort(),
                        inbound.getSni(), inbound.getPublicKey(), inbound.getShortId(), remark);
            case "hysteria2":
                requireCredential(password, "Hysteria2");
                return SingboxUtil.buildHysteria2Link(password, endpointHost, forward.getInPort(),
                        inbound.getSni(), remark);
            case "tuic":
                requireCredential(uuid, "TUIC");
                requireCredential(password, "TUIC");
                return SingboxUtil.buildTuicLink(uuid, password, endpointHost, forward.getInPort(),
                        inbound.getSni(), remark);
            case "anytls":
                requireCredential(password, "AnyTLS");
                return SingboxUtil.buildAnyTlsLink(password, endpointHost, forward.getInPort(),
                        inbound.getSni(), remark);
            case "vless":
            default:
                requireCredential(uuid, "VLESS");
                return SingboxUtil.buildVlessRealityLink(uuid, endpointHost, forward.getInPort(),
                        inbound.getSni(), inbound.getPublicKey(), inbound.getShortId(), remark);
        }
    }

    /**
     * 只替换原始分享链接的 host/port。URI 的 userinfo、query、fragment 和扩展
     * 参数全部按原文本保留;VMess 则只改 JSON 的 add/port/ps。
     */
    public static String rewriteSourceLink(String sourceLink, String endpointHost,
                                           Integer endpointPort, String nodeName) {
        String source = normalizeSourceLink(sourceLink);
        String validationError = validateSourceLink(source);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }
        if (endpointPort == null || endpointPort < 1 || endpointPort > 65535) {
            throw new IllegalArgumentException("转发入口端口无效");
        }
        String host = normalizeEndpointHost(endpointHost);
        if (host == null) {
            throw new IllegalArgumentException("入口节点没有可用地址");
        }

        int schemeSeparator = source.indexOf("://");
        String scheme = source.substring(0, schemeSeparator).toLowerCase(Locale.ROOT);
        if ("vmess".equals(scheme)) {
            JSONObject vmess = parseVmess(source, schemeSeparator);
            vmess.put("add", host);
            Object oldPort = vmess.get("port");
            vmess.put("port", oldPort instanceof Number ? endpointPort : String.valueOf(endpointPort));
            if (nodeName != null && !nodeName.trim().isEmpty()) {
                vmess.put("ps", nodeName.trim());
            }
            String encoded = Base64.getEncoder().encodeToString(
                    JSON.toJSONString(vmess).getBytes(StandardCharsets.UTF_8));
            return source.substring(0, schemeSeparator + 3) + encoded;
        }

        if ("ss".equals(scheme)) {
            try {
                UriSource uri = parseUriSource(source, schemeSeparator);
                return uri.schemePrefix + uri.userInfo + formatUriHost(host) + ":" + endpointPort + uri.suffix;
            } catch (IllegalArgumentException ignored) {
                // 兼容 ss://Base64(method:password@host:port)#备注 这种旧式分享格式。
                return rewriteLegacyShadowsocks(source, schemeSeparator, host, endpointPort);
            }
        }

        UriSource uri = parseUriSource(source, schemeSeparator);
        return uri.schemePrefix + uri.userInfo + formatUriHost(host) + ":" + endpointPort + uri.suffix;
    }

    /** 节点域名优先,否则使用 server_ip;多候选地址只取第一个可展示值。 */
    public static String resolveNodeEndpoint(Node node) {
        if (node == null) {
            throw new IllegalArgumentException("入口节点不存在");
        }
        String configured = normalizeEndpointHost(firstCandidate(node.getDomain()));
        if (configured != null) {
            return configured;
        }
        String serverIp = normalizeEndpointHost(firstCandidate(node.getServerIp()));
        if (serverIp == null) {
            throw new IllegalArgumentException("入口节点没有可用地址");
        }
        return serverIp;
    }

    /** 现有订阅的备注规则也由共享工具负责,保持自动链接输出一致。 */
    public static String buildRemark(Inbound inbound, Node node, String namePrefix) {
        String remark = inbound.getRemark() != null && !inbound.getRemark().isEmpty()
                ? inbound.getRemark() : protocolDisplayName(inbound.getProtocol());
        if (namePrefix != null && !namePrefix.isEmpty()) {
            return namePrefix + remark;
        }
        return countryPrefix(node) + remark;
    }

    public static String protocolDisplayName(String protocol) {
        if (protocol == null) {
            return "VLESS";
        }
        switch (protocol.toLowerCase(Locale.ROOT)) {
            case "shadowsocks": return "Shadowsocks";
            case "vmess": return "VMess";
            case "trojan": return "Trojan";
            case "hysteria2": return "Hysteria2";
            case "tuic": return "TUIC";
            case "anytls": return "AnyTLS";
            default: return "VLESS";
        }
    }

    private static String countryPrefix(Node node) {
        if (node == null || node.getCountry() == null) {
            return "";
        }
        String country = node.getCountry().trim().toUpperCase(Locale.ROOT);
        if (!country.matches("[A-Z]{2}")) {
            return "";
        }
        String flag = new String(Character.toChars(0x1F1E6 + country.charAt(0) - 'A'))
                + new String(Character.toChars(0x1F1E6 + country.charAt(1) - 'A'));
        return flag + " " + country + " ";
    }

    private static JSONObject parseConfig(String configJson) {
        if (configJson == null || configJson.trim().isEmpty()) {
            return new JSONObject();
        }
        try {
            return JSON.parseObject(configJson);
        } catch (Exception e) {
            throw new IllegalArgumentException("协议配置解析失败");
        }
    }

    private static void requireCredential(String value, String protocol) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(protocol + " 协议凭证不完整");
        }
    }

    private static JSONObject parseVmess(String source, int schemeSeparator) {
        String encoded = source.substring(schemeSeparator + 3).trim();
        int fragment = encoded.indexOf('#');
        if (fragment >= 0) {
            encoded = encoded.substring(0, fragment);
        }
        if (encoded.isEmpty() || containsLineBreak(encoded)) {
            throw new IllegalArgumentException("VMess 链接内容无效");
        }
        try {
            byte[] decoded = decodeBase64(encoded);
            JSONObject vmess = JSON.parseObject(new String(decoded, StandardCharsets.UTF_8));
            if (vmess == null || vmess.isEmpty()) {
                throw new IllegalArgumentException("VMess 链接内容无效");
            }
            String add = vmess.getString("add");
            if (add == null || add.trim().isEmpty()) {
                throw new IllegalArgumentException("VMess 链接缺少服务器地址");
            }
            parsePort(vmess.get("port"), "VMess 链接端口无效");
            if (vmess.getString("id") == null || vmess.getString("id").trim().isEmpty()) {
                throw new IllegalArgumentException("VMess 链接缺少认证信息");
            }
            return vmess;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("VMess 链接内容无效");
        }
    }

    private static byte[] decodeBase64(String value) {
        String encoded = value.replaceAll("\\s", "");
        int padding = encoded.length() % 4;
        if (padding != 0) {
            StringBuilder padded = new StringBuilder(encoded);
            for (int i = padding; i < 4; i++) {
                padded.append('=');
            }
            encoded = padded.toString();
        }
        try {
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException first) {
            try {
                return Base64.getUrlDecoder().decode(encoded);
            } catch (IllegalArgumentException second) {
                throw new IllegalArgumentException("编码链接内容无效");
            }
        }
    }

    private static String rewriteLegacyShadowsocks(String source, int schemeSeparator,
                                                    String endpointHost, int endpointPort) {
        int payloadStart = schemeSeparator + 3;
        // Base64 负载使用标准编码时可能自然包含 '/',不能把它误判成 URI 路径。
        int payloadEnd = firstIndexOf(source, payloadStart, '?', '#');
        String encoded = source.substring(payloadStart, payloadEnd).trim();
        if (encoded.isEmpty()) {
            throw new IllegalArgumentException("Shadowsocks 链接内容无效");
        }
        final String decoded;
        try {
            decoded = new String(decodeBase64(encoded), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Shadowsocks 链接内容无效");
        }
        int at = decoded.lastIndexOf('@');
        if (at <= 0 || at == decoded.length() - 1) {
            throw new IllegalArgumentException("Shadowsocks 链接缺少认证信息或服务器地址");
        }
        parseHostPort(decoded.substring(at + 1));
        String rewritten = decoded.substring(0, at + 1) + formatUriHost(endpointHost) + ":" + endpointPort;
        String reencoded = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(rewritten.getBytes(StandardCharsets.UTF_8));
        return source.substring(0, payloadStart) + reencoded + source.substring(payloadEnd);
    }

    private static void validateLegacyShadowsocks(String source, int schemeSeparator) {
        int payloadStart = schemeSeparator + 3;
        int payloadEnd = firstIndexOf(source, payloadStart, '?', '#');
        String encoded = source.substring(payloadStart, payloadEnd).trim();
        if (encoded.isEmpty()) {
            throw new IllegalArgumentException("Shadowsocks 链接内容无效");
        }
        final String decoded;
        try {
            decoded = new String(decodeBase64(encoded), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Shadowsocks 链接内容无效");
        }
        int at = decoded.lastIndexOf('@');
        if (at <= 0 || at == decoded.length() - 1) {
            throw new IllegalArgumentException("Shadowsocks 链接缺少认证信息或服务器地址");
        }
        parseHostPort(decoded.substring(at + 1));
    }

    private static UriSource parseUriSource(String source, int schemeSeparator) {
        int authorityStart = schemeSeparator + 3;
        int authorityEnd = firstIndexOf(source, authorityStart, '/', '?', '#');
        String authority = source.substring(authorityStart, authorityEnd);
        if (authority.isEmpty()) {
            throw new IllegalArgumentException("协议链接缺少服务器地址");
        }
        int at = authority.lastIndexOf('@');
        if (at <= 0 || at == authority.length() - 1) {
            throw new IllegalArgumentException("协议链接缺少认证信息或服务器地址");
        }
        String userInfo = authority.substring(0, at + 1);
        String hostPort = authority.substring(at + 1);
        parseHostPort(hostPort);
        return new UriSource(source.substring(0, schemeSeparator + 3), userInfo,
                source.substring(authorityEnd));
    }

    private static HostPort parseHostPort(String hostPort) {
        String host;
        String portText;
        if (hostPort.startsWith("[")) {
            int close = hostPort.indexOf(']');
            if (close <= 1 || close + 1 >= hostPort.length() || hostPort.charAt(close + 1) != ':') {
                throw new IllegalArgumentException("协议链接服务器地址格式不正确");
            }
            host = hostPort.substring(1, close);
            portText = hostPort.substring(close + 2);
        } else {
            int colon = hostPort.lastIndexOf(':');
            if (colon <= 0 || colon != hostPort.indexOf(':')) {
                throw new IllegalArgumentException("协议链接服务器地址格式不正确");
            }
            host = hostPort.substring(0, colon);
            portText = hostPort.substring(colon + 1);
        }
        if (host.isEmpty() || host.matches(".*[\\s/?#@].*")) {
            throw new IllegalArgumentException("协议链接服务器地址格式不正确");
        }
        int port = parsePort(portText, "协议链接端口无效");
        return new HostPort(host, port);
    }

    private static int parsePort(Object portValue, String message) {
        if (portValue == null) {
            throw new IllegalArgumentException(message);
        }
        try {
            int port = portValue instanceof Number
                    ? ((Number) portValue).intValue() : Integer.parseInt(String.valueOf(portValue).trim());
            if (port < 1 || port > 65535) {
                throw new IllegalArgumentException(message);
            }
            return port;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(message);
        }
    }

    private static int firstIndexOf(String value, int start, char... chars) {
        int index = value.length();
        for (char c : chars) {
            int candidate = value.indexOf(c, start);
            if (candidate >= 0 && candidate < index) {
                index = candidate;
            }
        }
        return index;
    }

    private static boolean containsLineBreak(String value) {
        return value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0;
    }

    private static String firstCandidate(String value) {
        if (value == null) {
            return null;
        }
        int comma = value.indexOf(',');
        return comma >= 0 ? value.substring(0, comma) : value;
    }

    private static String normalizeEndpointHost(String endpointHost) {
        if (endpointHost == null) {
            return null;
        }
        String host = endpointHost.trim();
        if (host.startsWith("[") && host.endsWith("]") && host.length() > 2) {
            host = host.substring(1, host.length() - 1);
        }
        if (host.isEmpty() || host.matches(".*[\\s/?#@].*")) {
            return null;
        }
        String lower = host.toLowerCase(Locale.ROOT);
        if ("localhost".equals(lower) || "::1".equals(lower) || "0.0.0.0".equals(lower)
                || lower.startsWith("127.")) {
            throw new IllegalArgumentException("入口节点地址不能是本机回环地址");
        }
        return host;
    }

    private static String formatUriHost(String host) {
        return host.indexOf(':') >= 0 ? "[" + host + "]" : host;
    }

    private static final class UriSource {
        private final String schemePrefix;
        private final String userInfo;
        private final String suffix;

        private UriSource(String schemePrefix, String userInfo, String suffix) {
            this.schemePrefix = schemePrefix;
            this.userInfo = userInfo;
            this.suffix = suffix;
        }
    }

    private static final class HostPort {
        private final String host;
        private final int port;

        private HostPort(String host, int port) {
            this.host = host;
            this.port = port;
        }
    }
}
