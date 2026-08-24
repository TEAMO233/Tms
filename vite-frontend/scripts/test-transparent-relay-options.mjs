import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const projectRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "transparent-relay-options-"));

try {
  const outfile = join(tempDir, "transparent-relay-options.mjs");

  await esbuild.build({
    entryPoints: [resolve(projectRoot, "src/utils/transparent-relay-options.ts")],
    outfile,
    platform: "node",
    format: "esm",
    bundle: true,
    logLevel: "silent",
  });

  const { buildTargetHostOptions, isUdpQuicProxyProtocol } = await import(pathToFileURL(outfile).href);

  const options = buildTargetHostOptions([
    {
      id: 1,
      name: "本机",
      country: "SG",
      serverIp: "140.245.126.119",
      ip: "140.245.126.119",
    },
    {
      id: 2,
      name: "vmiss日本",
      country: "JP",
      serverIp: "64.83.37.138",
      ip: "64.83.37.138, 127.0.0.1, bad-ip, 64.83.37.138",
    },
  ]);

  assert.deepEqual(
    options.map((option) => option.label),
    [
      "本机 SG · 服务器IP/入口IP · 140.245.126.119",
      "vmiss日本 JP · 服务器IP/入口IP · 64.83.37.138",
    ],
  );
  assert.deepEqual(
    options.map((option) => [option.key, option.value, option.nodeId]),
    [
      ["1:140.245.126.119", "140.245.126.119", 1],
      ["2:64.83.37.138", "64.83.37.138", 2],
    ],
  );
  assert.equal(isUdpQuicProxyProtocol("hysteria2"), true);
  assert.equal(isUdpQuicProxyProtocol("TUIC"), true);
  assert.equal(isUdpQuicProxyProtocol("vless"), false);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
