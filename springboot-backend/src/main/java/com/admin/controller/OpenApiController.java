package com.admin.controller;


import com.admin.common.aop.LogAnnotation;
import com.admin.common.lang.R;
import javax.servlet.http.HttpServletResponse;

import com.admin.common.utils.Md5Util;
import com.admin.entity.User;
import com.admin.entity.UserTunnel;
import com.admin.entity.InboundUser;
import com.admin.mapper.InboundUserMapper;
import com.admin.service.InboundService;
import com.admin.service.ForwardService;
import com.admin.service.TransparentRelayService;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/open_api")
public class OpenApiController extends BaseController {

    @Autowired
    private InboundService inboundService;

    @Autowired
    private ForwardService forwardService;

    @Autowired
    private TransparentRelayService transparentRelayService;

    @Autowired
    private InboundUserMapper inboundUserMapper;

    /** 订阅:按 token 返回该用户所有协议链接的 base64(客户端订阅用,免登录) */
    @GetMapping("/sub")
    public String sub(@RequestParam("token") String token, HttpServletResponse response) {
        // 单线路订阅供 Sub-Store 的 /flow 接口读取用量;聚合订阅没有唯一配额,不伪造流量头。
        // 同一线路的多个协议会共享一个 sub_token,所以按匹配记录的【唯一用户】判断;
        // 若异常地跨用户复用 token,直接不返回流量头,避免泄露错误用户的用量信息。
        if (token == null || token.trim().isEmpty()) {
            return "";
        }
        List<InboundUser> lines = inboundUserMapper.selectList(new QueryWrapper<InboundUser>()
                .eq("sub_token", token));
        Long ownerUserId = null;
        boolean ambiguousOwner = false;
        for (InboundUser line : lines) {
            if (line.getUserId() == null) {
                continue;
            }
            if (ownerUserId == null) {
                ownerUserId = line.getUserId();
            } else if (!ownerUserId.equals(line.getUserId())) {
                ambiguousOwner = true;
                break;
            }
        }
        if (!ambiguousOwner && ownerUserId != null) {
            User userInfo = userService.getById(ownerUserId);
            if (userInfo != null) {
                final long GIGA = 1024L * 1024L * 1024L;
                response.setHeader("subscription-userinfo", buildSubscriptionHeader(
                        userInfo.getOutFlow() == null ? 0 : userInfo.getOutFlow(),
                        userInfo.getInFlow() == null ? 0 : userInfo.getInFlow(),
                        (userInfo.getFlow() == null ? 0 : userInfo.getFlow()) * GIGA,
                        userInfo.getExpTime() == null ? 0 : userInfo.getExpTime() / 1000
                ));
            }
        }
        return inboundService.buildSubscription(token);
    }

    /** 转发订阅:按 token 返回该用户当前可用转发的 Base64 客户端链接,免登录。 */
    @GetMapping("/forward_sub")
    public String forwardSub(@RequestParam("token") String token) {
        return forwardService.buildForwardSubscription(token);
    }

    /** 透明中转独立订阅:只包含透明中转页里的 L4 与 HY2/TUIC 协议中转,免登录。 */
    @GetMapping("/transparent_relay_sub")
    public String transparentRelaySub(@RequestParam("token") String token) {
        return transparentRelayService.buildSubscription(token);
    }

    @LogAnnotation
    @GetMapping("/sub_store")
    public Object create(
            @RequestParam("user") String user,
            @RequestParam("pwd") String pwd,
            @RequestParam(value = "tunnel", required = false, defaultValue = "-1") String tunnel,
            HttpServletResponse response) {
        JSONObject result = new JSONObject();
        result.put("upload", 0);
        result.put("download", 0);
        result.put("total", 0);
        result.put("expire", 0);
        // 校验 user 是否为空
        if (user == null || user.isEmpty()) {
            return R.err("用户不能为空");
        }
        if (pwd == null || pwd.isEmpty()) {
            return R.err("密码不能为空");
        }

        User userInfo = userService.getOne(new QueryWrapper<User>().eq("user", user));
        if (userInfo == null) {
            return R.err("鉴权失败");
        }

        String pwdMd5 = Md5Util.md5(pwd);
        if (!Objects.equals(pwdMd5, userInfo.getPwd())) {
            return R.err("鉴权失败");
        }

        final long GIGA = 1024L * 1024L * 1024L;
        String headerValue;

        if ("-1".equals(tunnel)) {
            headerValue = buildSubscriptionHeader(
                    userInfo.getOutFlow(),
                    userInfo.getInFlow(),
                    userInfo.getFlow() * GIGA,
                    // 没设到期就报 0(订阅协议里 expire=0 = 不过期);别直接拆箱,老数据里可能是 null
                    userInfo.getExpTime() == null ? 0 : userInfo.getExpTime() / 1000
            );
        } else {
            UserTunnel tunnelInfo = userTunnelService.getById(tunnel);
            if (tunnelInfo == null) return R.err("隧道不存在");
            if (!tunnelInfo.getUserId().toString().equals(userInfo.getId().toString())) return R.err("隧道不存在");
            headerValue = buildSubscriptionHeader(
                    tunnelInfo.getOutFlow(),
                    tunnelInfo.getInFlow(),
                    tunnelInfo.getFlow() * GIGA,
                    tunnelInfo.getExpTime() == null ? 0 : tunnelInfo.getExpTime() / 1000
            );
        }

        response.setHeader("subscription-userinfo", headerValue);
        return headerValue;
    }



    private String buildSubscriptionHeader(long upload, long download, long total, long expire) {
        return String.format("upload=%d; download=%d; total=%d; expire=%d", download, upload, total, expire);
    }


}
