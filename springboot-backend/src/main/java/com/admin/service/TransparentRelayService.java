package com.admin.service;

import com.admin.common.dto.TransparentRelayBatchDto;
import com.admin.common.dto.TransparentRelayDto;
import com.admin.common.dto.TransparentRelayStatusDto;
import com.admin.common.dto.TransparentRelayUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.TransparentRelay;
import com.baomidou.mybatisplus.extension.service.IService;

public interface TransparentRelayService extends IService<TransparentRelay> {
    R createRelay(TransparentRelayDto dto);

    R createBatchRelays(TransparentRelayBatchDto dto);

    R getAllRelays();

    R updateRelay(TransparentRelayUpdateDto dto);

    R deleteRelay(Long id);

    R pauseRelay(Long id);

    R resumeRelay(Long id);

    R getNodeStatus(TransparentRelayStatusDto dto);

    R getSubscriptionLink(Long id);

    R createSubscription();

    String buildSubscription(String token);
}
