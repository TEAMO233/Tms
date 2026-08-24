import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const projectRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "forward-groups-"));

try {
  const outfile = join(tempDir, "forward-groups.mjs");

  await esbuild.build({
    entryPoints: [resolve(projectRoot, "src/utils/forward-groups.ts")],
    outfile,
    platform: "node",
    format: "esm",
    bundle: true,
    logLevel: "silent",
  });

  const { isProtocolManagedForward, splitForwardGroups } = await import(pathToFileURL(outfile).href);

  const forwards = [
    {
      id: 1,
      name: "home-web",
      tunnelName: "manual-jp-relay",
      tunnelId: 1,
      inIp: "64.83.37.138",
      inPort: 31000,
      remoteAddr: "127.0.0.1:8080",
      strategy: "fifo",
      status: 1,
      inFlow: 0,
      outFlow: 0,
      serviceRunning: true,
      createdTime: "",
    },
    {
      id: 2,
      name: "inbound-38-user-1",
      tunnelName: "manual-looking-tunnel",
      tunnelId: 2,
      inIp: "64.83.37.138",
      inPort: 20000,
      remoteAddr: "127.0.0.1:40006",
      strategy: "fifo",
      status: 1,
      inFlow: 0,
      outFlow: 0,
      serviceRunning: true,
      createdTime: "",
    },
    {
      id: 3,
      name: "friendly-name",
      tunnelName: "inbound-tunnel-node2",
      tunnelId: 3,
      inIp: "64.83.37.138",
      inPort: 20001,
      remoteAddr: "127.0.0.1:40007",
      strategy: "fifo",
      status: 1,
      inFlow: 0,
      outFlow: 0,
      serviceRunning: true,
      createdTime: "",
    },
    {
      id: 4,
      name: "api-backend",
      tunnelName: "normal-tunnel",
      tunnelId: 4,
      inIp: "140.245.126.119",
      inPort: 32000,
      remoteAddr: "10.0.0.2:443",
      strategy: "fifo",
      status: 1,
      inFlow: 0,
      outFlow: 0,
      serviceRunning: true,
      createdTime: "",
      protocolManaged: true,
    },
  ];

  assert.equal(isProtocolManagedForward(forwards[0]), false);
  assert.equal(isProtocolManagedForward(forwards[1]), true);
  assert.equal(isProtocolManagedForward(forwards[2]), true);
  assert.equal(isProtocolManagedForward(forwards[3]), true);

  const grouped = splitForwardGroups(forwards);
  assert.deepEqual(grouped.manualForwards.map((forward) => forward.id), [1]);
  assert.deepEqual(grouped.protocolManagedForwards.map((forward) => forward.id), [2, 3, 4]);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
