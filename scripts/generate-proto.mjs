#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const output = "proto/agent_pb.ts";
const plugin = resolve("node_modules/.bin/protoc-gen-es");
const result = spawnSync("protoc", [
  `--plugin=protoc-gen-es=${plugin}`,
  "--es_out=proto",
  "--es_opt=target=ts,ts_nocheck=true",
  "-I",
  "proto",
  "proto/agent.proto",
], { stdio: "inherit" });

if (result.error) {
  console.error(`Unable to run protoc: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  // Keep generator output compatible with the repository whitespace check.
  writeFileSync(output, `${readFileSync(output, "utf8").trimEnd()}\n`);
}
