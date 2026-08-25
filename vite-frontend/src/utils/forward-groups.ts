import type { Forward } from "@/types";

const PROTOCOL_FORWARD_NAME_PATTERN = /^inbound-\d+-user-\d+$/i;
const PROTOCOL_TUNNEL_NAME_PATTERN = /^inbound-tunnel-node\d+$/i;

export interface ForwardDisplayGroups {
  manualForwards: Forward[];
  protocolManagedForwards: Forward[];
}

export const isProtocolManagedForward = (
  forward: Pick<Forward, "name" | "tunnelName" | "protocolManaged">,
): boolean => {
  if (forward.protocolManaged === true) return true;
  const name = forward.name || "";
  const tunnelName = forward.tunnelName || "";

  return (
    PROTOCOL_FORWARD_NAME_PATTERN.test(name) ||
    PROTOCOL_TUNNEL_NAME_PATTERN.test(tunnelName)
  );
};

export const splitForwardGroups = (forwards: Forward[]): ForwardDisplayGroups =>
  forwards.reduce<ForwardDisplayGroups>(
    (groups, forward) => {
      if (isProtocolManagedForward(forward)) {
        groups.protocolManagedForwards.push(forward);
      } else {
        groups.manualForwards.push(forward);
      }

      return groups;
    },
    { manualForwards: [], protocolManagedForwards: [] },
  );
