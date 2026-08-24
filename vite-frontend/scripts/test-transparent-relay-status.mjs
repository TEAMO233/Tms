import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const projectRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "transparent-relay-status-"));

try {
  const outfile = join(tempDir, "transparent-relay-status.mjs");

  await esbuild.build({
    entryPoints: [resolve(projectRoot, "src/utils/transparent-relay-status.ts")],
    outfile,
    platform: "node",
    format: "esm",
    bundle: true,
    logLevel: "silent",
  });

  const { summarizeTransparentRelayStatus } = await import(pathToFileURL(outfile).href);

  const ruleset = `table ip tms_transparent_relay {
    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;
        tcp dport 46132 counter packets 72 bytes 4596 dnat to 140.245.126.119:20000
        udp dport 46132 counter packets 0 bytes 0 dnat to 140.245.126.119:20000
    }

    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        ip daddr 140.245.126.119 tcp dport 20000 counter packets 72 bytes 4596 masquerade
        ip daddr 140.245.126.119 udp dport 20000 counter packets 0 bytes 0 masquerade
    }
}`;

  const summary = summarizeTransparentRelayStatus(
    { ipForward: true, exists: true, ruleset },
    [
      {
        id: 1,
        name: "JP -> SG HY2",
        inNodeId: 2,
        entryPort: 46132,
        targetHost: "140.245.126.119",
        targetPort: 20000,
        protocol: "tcp_udp",
        masquerade: true,
        status: 1,
      },
    ],
  );

  assert.equal(summary.level, "success");
  assert.equal(summary.title, "规则已生效");
  assert.equal(summary.ipForward.ok, true);
  assert.equal(summary.table.ok, true);
  assert.equal(summary.routes.length, 2);
  assert.deepEqual(
    summary.routes.map((route) => [route.protocolLabel, route.entryPort, route.target, route.flowText, route.active]),
    [
      ["TCP", 46132, "140.245.126.119:20000", "72 包 / 4.49 KB", true],
      ["UDP", 46132, "140.245.126.119:20000", "暂无流量", false],
    ],
  );
  assert.equal(summary.routes[0].relayName, "JP -> SG HY2");
  assert.equal(summary.pathText, "客户端 → 入口节点:46132 → 140.245.126.119:20000 → 真实出口");

  const broken = summarizeTransparentRelayStatus({ ipForward: false, exists: false, ruleset: "" }, []);

  assert.equal(broken.level, "danger");
  assert.equal(broken.ipForward.ok, false);
  assert.equal(broken.table.ok, false);
  assert.equal(broken.routes.length, 0);
  assert.match(broken.description, /没有在节点上看到透明中转规则/);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
