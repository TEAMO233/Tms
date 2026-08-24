package com.admin.common.utils;

import com.admin.common.dto.GostDto;
import com.admin.entity.TransparentRelay;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;

import java.util.List;

/** 透明中转节点命令工具。只下发结构化规则,不允许任意 shell 命令。 */
public class TransparentRelayUtil {

    public static GostDto SetTransparentRelays(Long nodeId, List<TransparentRelay> relays) {
        JSONObject payload = new JSONObject();
        JSONArray rules = new JSONArray();
        if (relays != null) {
            for (TransparentRelay relay : relays) {
                JSONObject rule = new JSONObject();
                rule.put("id", relay.getId());
                rule.put("name", relay.getName());
                rule.put("entryPort", relay.getEntryPort());
                rule.put("targetHost", relay.getTargetHost());
                rule.put("targetPort", relay.getTargetPort());
                rule.put("protocol", relay.getProtocol());
                rule.put("masquerade", relay.getMasquerade() == null || relay.getMasquerade());
                rules.add(rule);
            }
        }
        payload.put("rules", rules);
        return WebSocketServer.send_msg(nodeId, payload, "SetTransparentRelays");
    }

    public static GostDto GetTransparentRelayStatus(Long nodeId) {
        return WebSocketServer.send_msg(nodeId, new JSONObject(), "GetTransparentRelayStatus");
    }
}
