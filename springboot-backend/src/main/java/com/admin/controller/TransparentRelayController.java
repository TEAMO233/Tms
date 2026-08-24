package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.TransparentRelayBatchDto;
import com.admin.common.dto.TransparentRelayDto;
import com.admin.common.dto.TransparentRelayStatusDto;
import com.admin.common.dto.TransparentRelayUpdateDto;
import com.admin.common.lang.R;
import com.admin.service.TransparentRelayService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/transparent-relay")
public class TransparentRelayController extends BaseController {

    @Autowired
    private TransparentRelayService transparentRelayService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody TransparentRelayDto dto) {
        return transparentRelayService.createRelay(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/batch-create")
    public R batchCreate(@Validated @RequestBody TransparentRelayBatchDto dto) {
        return transparentRelayService.createBatchRelays(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list() {
        return transparentRelayService.getAllRelays();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/update")
    public R update(@Validated @RequestBody TransparentRelayUpdateDto dto) {
        return transparentRelayService.updateRelay(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return transparentRelayService.deleteRelay(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/pause")
    public R pause(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return transparentRelayService.pauseRelay(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/resume")
    public R resume(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return transparentRelayService.resumeRelay(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/status")
    public R status(@Validated @RequestBody TransparentRelayStatusDto dto) {
        return transparentRelayService.getNodeStatus(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/subscription/link")
    public R subscriptionLink(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return transparentRelayService.getSubscriptionLink(id);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/subscription")
    public R subscription() {
        return transparentRelayService.createSubscription();
    }
}
