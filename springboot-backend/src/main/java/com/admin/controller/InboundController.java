package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.InboundDto;
import com.admin.common.dto.InboundUserDto;
import com.admin.common.lang.R;
import com.admin.service.InboundService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * <p>
 * 协议入站前端控制器(合体面板:协议 + 限速)
 * </p>
 *
 * @author QAQ
 * @since 2026-07-19
 */
@RestController
@RequestMapping("/api/v1/inbound")
@CrossOrigin
public class InboundController extends BaseController {

    @Autowired
    private InboundService inboundService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody InboundDto dto) {
        return inboundService.createInbound(dto);
    }

    /** 一键添加:在指定节点上把所有支持的协议一键全建出来(像 s-ui 的一键添加) */
    @LogAnnotation
    @RequireRole
    @PostMapping("/one-click")
    public R oneClick(@RequestBody Map<String, Object> body) {
        return inboundService.oneClickCreate(Long.valueOf(String.valueOf(body.get("nodeId"))));
    }

    /** 一键搭中转:在前置机上建全套协议,流量经内联粘贴的落地出网 */
    @LogAnnotation
    @RequireRole
    @PostMapping("/one-click-relay")
    public R oneClickRelay(@RequestBody Map<String, Object> body) {
        return inboundService.oneClickRelay(
                Long.valueOf(String.valueOf(body.get("nodeId"))),
                String.valueOf(body.get("link")),
                body.get("name") == null ? null : String.valueOf(body.get("name")));
    }

    @RequireRole
    @PostMapping("/list")
    public R list() {
        return inboundService.getInbounds();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> body) {
        return inboundService.deleteInbound(Long.valueOf(String.valueOf(body.get("id"))));
    }

    /** 清空某节点上目标组的协议(relay=true 清某落地的中转;否则清直连) */
    @LogAnnotation
    @RequireRole
    @PostMapping("/delete-by-node")
    public R deleteByNode(@RequestBody Map<String, Object> body) {
        Boolean relay = body.get("relay") != null && Boolean.parseBoolean(String.valueOf(body.get("relay")));
        Long landingId = body.get("landingId") == null ? null : Long.valueOf(String.valueOf(body.get("landingId")));
        return inboundService.deleteInboundsByNode(Long.valueOf(String.valueOf(body.get("nodeId"))), relay, landingId);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/assign")
    public R assign(@Validated @RequestBody InboundUserDto dto) {
        return inboundService.assignUser(dto);
    }

    /** 一键给车友分配全部协议 → 出订阅链接 */
    @LogAnnotation
    @RequireRole
    @PostMapping("/assign-all")
    public R assignAll(@RequestBody InboundUserDto dto) {
        return inboundService.assignAllToUser(dto);
    }

    /** 取某车友的订阅 token(兼容旧接口) */
    @RequireRole
    @PostMapping("/user-sub")
    public R userSub(@RequestBody Map<String, Object> body) {
        return R.ok(inboundService.getUserSubToken(Long.valueOf(String.valueOf(body.get("userId")))));
    }

    /** 取某车友的所有订阅线路(车友×机器,直连/中转各一条) */
    @RequireRole
    @PostMapping("/user-lines")
    public R userLines(@RequestBody Map<String, Object> body) {
        return inboundService.getUserLines(Long.valueOf(String.valueOf(body.get("userId"))));
    }

    /** 车友自助:取【我自己】的订阅线路(不需要管理员权限,只能看自己的) */
    @PostMapping("/my-lines")
    public R myLines() {
        Integer uid = com.admin.common.utils.JwtUtil.getUserIdFromToken();
        if (uid == null) {
            return R.err("未登录");
        }
        return inboundService.getUserLines(uid.longValue());
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/unassign")
    public R unassign(@RequestBody Map<String, Object> body) {
        return inboundService.unassignUser(Long.valueOf(String.valueOf(body.get("id"))));
    }
}
