package com.admin.common.utils;

import cn.hutool.http.HttpResponse;
import cn.hutool.http.HttpUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import lombok.extern.slf4j.Slf4j;

import java.net.InetAddress;
import java.util.Locale;

/**
 * 节点公网地址的 GeoIP 查询工具。
 *
 * 节点创建和编辑属于管理员主动操作,这里允许同步等待一次短请求,但不能让外部
 * GeoIP 服务成为节点管理接口的硬依赖,所以所有异常都降级成空国家码。
 */
@Slf4j
public final class GeoIpUtil {

    private static final String API_URL = "http://ip-api.com/json/";
    private static final int TIMEOUT_MILLISECONDS = 3000;

    private GeoIpUtil() {
    }

    /**
     * 查询 IP 对应的 ISO 3166-1 alpha-2 国家码。
     * 非公网地址、响应异常和外部服务不可达时返回 null。
     */
    public static String lookup(String ip) {
        String target = ip == null ? "" : ip.trim();
        if (target.isEmpty() || isPrivateOrReserved(target)) {
            log.debug("GeoIP探测跳过非公网地址: {}", target);
            return null;
        }

        try {
            String url = API_URL + target + "?fields=status,countryCode";
            HttpResponse response = HttpUtil.createGet(url)
                    .setConnectionTimeout(TIMEOUT_MILLISECONDS)
                    .setReadTimeout(TIMEOUT_MILLISECONDS)
                    .execute();
            try {
                if (response.getStatus() != 200) {
                    log.debug("GeoIP探测返回非200状态: ip={}, status={}", target, response.getStatus());
                    return null;
                }
                JSONObject result = JSON.parseObject(response.body());
                if (!"success".equalsIgnoreCase(result.getString("status"))) {
                    log.debug("GeoIP探测未成功: ip={}, status={}", target, result.getString("status"));
                    return null;
                }
                return normalizeCountry(result.getString("countryCode"));
            } finally {
                response.close();
            }
        } catch (Exception e) {
            // GeoIP 只是节点名称的增强信息,失败时必须保留原有节点管理流程。
            log.debug("GeoIP探测失败: ip={}, reason={}", target, e.getMessage());
            return null;
        }
    }

    private static String normalizeCountry(String country) {
        if (country == null) {
            return null;
        }
        String normalized = country.trim().toUpperCase(Locale.ROOT);
        return normalized.matches("[A-Z]{2}") ? normalized : null;
    }

    private static boolean isPrivateOrReserved(String value) {
        // 节点输入也允许域名。域名交给带超时的 HTTP 请求处理,这里不提前做 DNS,
        // 否则一次本地 DNS 卡顿会叠加在 3 秒 GeoIP 超时之外。
        if (!value.matches("\\d{1,3}(\\.\\d{1,3}){3}") && !value.contains(":")) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(value);
            if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                    || address.isMulticastAddress()) {
                return true;
            }

            byte[] bytes = address.getAddress();
            if (bytes.length == 4) {
                int first = bytes[0] & 0xff;
                int second = bytes[1] & 0xff;
                int third = bytes[2] & 0xff;
                // CGNAT、未分配/文档保留网段和 IPv4 保留地址不应作为公网出口。
                return (first == 100 && second >= 64 && second <= 127)
                        || (first == 192 && ((second == 0 && (third == 0 || third == 2))
                        || second == 168 || (second == 88 && third == 99)))
                        || (first == 198 && (second == 18 || second == 19
                        || (second == 51 && third == 100)))
                        || (first == 203 && second == 0 && third == 113)
                        || first == 0 || first >= 224;
            }

            // IPv6 unique-local(fc00::/7)、文档保留段(2001:db8::/32)与未指定地址不属于公网地址。
            return bytes.length == 16
                    && ((bytes[0] & 0xfe) == 0xfc
                    || (bytes[0] & 0xff) == 0x20 && (bytes[1] & 0xff) == 0x01
                    && (bytes[2] & 0xff) == 0x0d && (bytes[3] & 0xff) == 0xb8);
        } catch (Exception e) {
            log.debug("GeoIP探测地址解析失败: ip={}, reason={}", value, e.getMessage());
            return true;
        }
    }
}
