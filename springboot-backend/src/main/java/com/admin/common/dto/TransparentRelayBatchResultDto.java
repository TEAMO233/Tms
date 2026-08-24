package com.admin.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransparentRelayBatchResultDto {
    private int targetCount;
    private int createdCount;
    private int skippedCount;
    private List<Integer> createdPorts;
    private List<Integer> skippedPorts;
    private List<String> skippedQuicProtocols;

    public TransparentRelayBatchResultDto(int targetCount, int createdCount, int skippedCount,
                                          List<Integer> createdPorts, List<Integer> skippedPorts) {
        this.targetCount = targetCount;
        this.createdCount = createdCount;
        this.skippedCount = skippedCount;
        this.createdPorts = createdPorts;
        this.skippedPorts = skippedPorts;
        this.skippedQuicProtocols = new ArrayList<>();
    }
}
