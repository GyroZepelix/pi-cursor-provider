import { afterEach, describe, expect, test } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots: string[] = [];
function fixture(models: unknown[]) {
  const root = mkdtempSync(join(tmpdir(), "cursor-refresh-test-"));
  roots.push(root);
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, ".pi", "agent"), { recursive: true });
  const script = join(root, "scripts", "refresh-models.mjs");
  copyFileSync(new URL("./scripts/refresh-models.mjs", import.meta.url), script);
  writeFileSync(join(root, ".pi", "agent", "cursor-models-cache.json"), JSON.stringify({ models }));
  const snapshot = join(root, "cursor-models-raw.json");
  writeFileSync(snapshot, "original snapshot\n");
  const run = () => spawnSync(process.execPath, [script], {
    env: { ...process.env, HOME: root }, encoding: "utf8", timeout: 5_000,
  });
  return { run, snapshot };
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("debug timeline", () => {
  test("elevates sanitized protocol drift, response, watchdog, failure, and stall events", () => {
    const root = mkdtempSync(join(tmpdir(), "cursor-timeline-test-"));
    roots.push(root);
    mkdirSync(join(root, "scripts"));
    const script = join(root, "scripts", "debug-log-timeline.mjs");
    copyFileSync(new URL("./scripts/debug-log-timeline.mjs", import.meta.url), script);
    const log = join(root, "debug.log");
    const base = { ts: "2026-09-22T20:00:00.000Z", requestId: "req-protocol" };
    writeFileSync(log, [
      { ...base, event: "http.chat.body", body: { model: "synthetic", stream: true, messages: [{}] } },
      { ...base, event: "exec.received", execMessageId: 4, execId: "exec-4", execCase: "mcpStateExecArgs" },
      { ...base, event: "exec.response", execMessageId: 4, execId: "exec-4", execCase: "mcpStateExecArgs", responseCase: "mcpStateExecResult" },
      { ...base, event: "exec.unknown_fields", execMessageId: 5, execId: "exec-5", unknownFields: [{ fieldNumber: 60, wireType: 2, byteLength: 16 }] },
      { ...base, event: "exec.watchdog_expired", execMessageId: 5, execId: "exec-5" },
      { ...base, event: "exec.protocol_failure", code: "cursor_protocol_error", unknownFields: [{ fieldNumber: 60, wireType: 2, byteLength: 16 }] },
      { ...base, event: "stream.stall_timeout" },
    ].map((entry) => JSON.stringify(entry)).join("\n") + "\n");

    const text = spawnSync(process.execPath, [script, log], { encoding: "utf8" });
    expect(text.status).toBe(0);
    expect(text.stdout).toContain("exec.response");
    expect(text.stdout).toContain("unknown:[60/w2/16b]");
    expect(text.stdout).toContain("PROTOCOL_FAILURE(code=cursor_protocol_error, fields=[60/w2/16b])");
    expect(text.stdout).toContain("STALL_TIMEOUT");
    expect(text.stdout).not.toContain("private");

    const json = spawnSync(process.execPath, [script, "--json", log], { encoding: "utf8" });
    expect(json.status).toBe(0);
    const summary = JSON.parse(json.stdout);
    expect(summary.notableCounts).toMatchObject({
      "exec.received": 1,
      "exec.response": 1,
      "exec.unknown_fields": 1,
      "exec.watchdog_expired": 1,
      "exec.protocol_failure": 1,
      "stream.stall_timeout": 1,
    });
    expect(summary.requests[0].protocolFailure.unknownFields).toEqual([
      { fieldNumber: 60, wireType: 2, byteLength: 16 },
    ]);
  });

  test("elevates progress timeouts and summarizes in-band replies, queries, and aborts", () => {
    const root = mkdtempSync(join(tmpdir(), "cursor-timeline-test-"));
    roots.push(root);
    mkdirSync(join(root, "scripts"));
    const script = join(root, "scripts", "debug-log-timeline.mjs");
    copyFileSync(new URL("./scripts/debug-log-timeline.mjs", import.meta.url), script);
    const log = join(root, "debug.log");
    const base = { ts: "2026-10-25T08:00:00.000Z", requestId: "req-stall" };
    writeFileSync(log, [
      { ...base, event: "http.chat.body", body: { model: "synthetic", stream: true, messages: [{}] } },
      { ...base, event: "exec.throw", execMessageId: 7, execId: "exec-7", execCase: "unknown", reason: "unknown_case" },
      { ...base, event: "exec.stream_close", execMessageId: 7 },
      { ...base, event: "exec.abort", execMessageId: 8, clearedWatchdog: false, abortedDelegated: true },
      { ...base, event: "interaction.response", queryId: 1, queryCase: "webSearchRequestQuery", responseCase: "webSearchRequestResponse" },
      { ...base, event: "interaction.unanswered", queryId: 2, queryCase: "setupVmEnvironmentArgs" },
      { ...base, event: "tool_resume.skipped_aborted", execMessageId: 8 },
      { ...base, event: "stream.progress_timeout", reason: "progress_timeout", limitMs: 180000, msSinceProgress: 180004,
        lastProgressAt: "2026-10-25T07:57:00.000Z", frameCounts: { "update:heartbeat": 18, exec: 1 } },
    ].map((entry) => JSON.stringify(entry)).join("\n") + "\n");

    const text = spawnSync(process.execPath, [script, log], { encoding: "utf8" });
    expect(text.status).toBe(0);
    expect(text.stdout).toContain("PROGRESS_TIMEOUT(limit=180000ms, sinceProgress=180004ms, frames={update:heartbeat=18, exec=1})");
    expect(text.stdout).not.toContain("STALL_TIMEOUT");
    expect(text.stdout).toContain("throw:unknown:exec-7");
    expect(text.stdout).toContain("streamClose:7");
    expect(text.stdout).toContain("abort:8:delegated");
    expect(text.stdout).toContain("query:webSearchRequestQuery->webSearchRequestResponse");
    expect(text.stdout).toContain("UNANSWERED_QUERY:setupVmEnvironmentArgs");
    expect(text.stdout).toContain("skippedAborted:8");

    const json = spawnSync(process.execPath, [script, "--json", log], { encoding: "utf8" });
    expect(json.status).toBe(0);
    const summary = JSON.parse(json.stdout);
    expect(summary.notableCounts).toMatchObject({
      "stream.progress_timeout": 1,
      "exec.throw": 1,
      "exec.stream_close": 1,
      "exec.abort": 1,
      "interaction.response": 1,
      "interaction.unanswered": 1,
      "tool_resume.skipped_aborted": 1,
    });
    expect(summary.requests[0]).toMatchObject({
      progressTimeout: true,
      stall: { reason: "progress_timeout", limitMs: 180000 },
    });
  });
});

describe("live smoke opt-in", () => {
  const script = new URL("./scripts/smoke-live.mjs", import.meta.url).pathname;
  test.each([[[]], [["--tool"]], [["--web-search"]]])("refuses without --live: %j", (args) => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 5_000 });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--web-search");
  });

  test("rejects combining --tool and --web-search before loading credentials", () => {
    const result = spawnSync(process.execPath, [script, "--live", "--tool", "--web-search"], {
      encoding: "utf8", timeout: 5_000, env: { ...process.env, HOME: tmpdir() },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("mutually exclusive");
  });
});

describe("model snapshot refresh", () => {
  test("publishes only normalized fields and preserves privacy labels", () => {
    const model = {
      id: "claude-fable-5-1-high", name: "Claude Fable 5.1 (NO ZDR)",
      reasoning: true, contextWindow: 200_000, maxTokens: 64_000,
      credentials: { accessToken: "test" },
    };
    const { run, snapshot } = fixture([model]);
    expect(run().status).toBe(0);
    const text = readFileSync(snapshot, "utf8");
    expect(JSON.parse(text)).toEqual([{
      id: model.id, name: model.name, reasoning: true, contextWindow: 200_000, maxTokens: 64_000,
    }]);
    expect(text).not.toContain('"credentials"');
    expect(text).not.toContain('"accessToken"');
  });

  test.each([null, {}, { id: "bad", name: "Bad", reasoning: false, contextWindow: -1, maxTokens: 1 }])(
    "invalid cache does not overwrite the snapshot: %j", (model) => {
      const { run, snapshot } = fixture([model]);
      expect(run().status).not.toBe(0);
      expect(readFileSync(snapshot, "utf8")).toBe("original snapshot\n");
    },
  );
});
