# Dream learnings: 261025-0746-fix-cursor-stalls-after-tool-result-resume

Work item: `261025-0746-fix-cursor-stalls-after-tool-result-resume`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261025-0746-fix-cursor-stalls-after-tool-result-resume/direct

Date: 2026-10-25
Dream log: [2026-10-25-0925-gamemaster-checkpoint-261025-0746-fix-cursor-stalls-after-tool-result-resume-dir.md](../2026-10-25-0925-gamemaster-checkpoint-261025-0746-fix-cursor-stalls-after-tool-result-resume-dir.md)
Outcome: retained learning

### Stall bounds and semantic progress

- **Exact written text:**
  > - Bridge heartbeat, HTTP/2 PING, activity timeout, and stream stall handling bound dead or stuck connections. A separate per-message control-exec watchdog uses the stall-timeout budget but is not reset by Cursor heartbeats; delegated `mcpArgs` execution is excluded, and in-band throw replies or Cursor aborts clear it (`proxy.ts`, `h2-bridge.mjs`, `bridge.test.ts`, `security.test.ts`).
  > - Streaming turns (fresh and tool-result resumes) have two bounds: the wire-idle stall timer (`PI_CURSOR_BRIDGE_STALL_TIMEOUT_MS`, 120 s, reset by any frame including heartbeats) and a semantic-progress watchdog (`PI_CURSOR_PROGRESS_TIMEOUT_MS`, 180 s, `0` disables) reset only by progress frames: non-empty text or reasoning, token deltas, tool-call, step, summary, and turn-ended updates, checkpoints, KV exchanges, answered or delegated execs, aborts, and answered interaction queries. `processServerMessage` returns this classification. Either expiry emits exactly one `cursor_stall_timeout` SSE error whose message contains `timeout` (Pi-retryable), then `[DONE]`, and cleans the bridge once; there is no proxy-internal replay and the last good checkpoint is kept. The parked writer between a tool-call pause and Pi's resume runs no timers (`proxy.ts`, `security.test.ts`, `index.test.ts`, `errors.test.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Fake-timer heartbeat-only, wire-idle, continuous-progress, parked-writer, and retry re-arm tests, plus a real Pi transport retryability test, proved the two bounds and the explicit error.
- **Expected future benefit:** Future lifecycle work keeps heartbeats out of progress, keeps the single retryable stall error, and does not reintroduce silent closes or indefinite waits.
- **Why this tier:** This is a stable runtime contract of the Cursor proxy, so it belongs with architecture rather than a repository-wide convention or a tentative observation.

### In-band exec, abort, and interaction replies

- **Exact written text:**
  > - Exec dispatch answers in band: each supported control exec receives its schema-matched response, native Cursor tools are rejected, `mcpArgs` delegates to Pi, and any exec that cannot be answered or delegated (decoded-but-unsupported, unknown oneof, or `mcpArgs` arguments that are neither a protobuf `Value` nor UTF-8) receives `ExecClientThrow` with a short sanitized error while the turn continues. Every exec reply, including delegated results written on resume and non-streaming rejections, is followed by `ExecClientControlMessage.stream_close` for the same id unless `PI_CURSOR_EXEC_STREAM_CLOSE=0|false`. Only an unwritable reply frame still terminates (`cursor_protocol_error`, pre-turn checkpoint restored) (`proxy.ts`, `index.test.ts`).
  > - `ExecServerControlMessage.abort{id}` clears control-watchdog entries for that id; a matching delegated `mcpArgs` awaiting Pi is marked aborted and its result is not written on resume (`proxy.ts`, `index.test.ts`).
  > - Interaction queries: web search, web fetch, Exa search, and Exa fetch are approved; ask-question and switch-mode are rejected and create-plan returns an error; VM setup and unknown cases get no reply and are bounded by the progress watchdog. The shared handling applies to streaming and non-streaming paths (`proxy.ts`, `index.test.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Fake-bridge reply traces for unknown, unsupported, and undecodable execs, every reply type with `stream_close` on and off, aborts, and each interaction query case, plus approved live tool and web-search smokes.
- **Expected future benefit:** Protocol changes can find where each Cursor frame is answered, and avoid regressing to fail-closed termination or leaving Cursor waiting on an unanswered frame.
- **Why this tier:** This is stable Cursor protocol-adapter architecture that replaces the previously recorded fail-closed contract; it is too specific for a broad convention.

### Session and replay invariants for in-band replies and stalls

- **Exact written text:**
  > - Treat late callbacks after shutdown, disposal, terminal protocol failure, or stall termination as inert; they must not repopulate state or start retries (`proxy.ts`, `security.test.ts`).
  > - Answer every answerable Cursor frame in band. Execs that cannot be answered or delegated receive a sanitized `ExecClientThrow` (no payload text) and the turn continues; exec replies are followed by `stream_close` unless disabled. Only an unwritable reply frame is a terminal, non-retryable protocol failure; it restores the pre-turn checkpoint and cleans bridge timers, listeners, and maps exactly once (`proxy.ts`, `index.test.ts`, `security.test.ts`). This replaced the earlier fail-closed exec termination (spec item `261025-0746-fix-cursor-stalls-after-tool-result-resume`).
  > - A streaming turn must not wait indefinitely. Wire-idle or no-progress expiry emits exactly one Pi-retryable `cursor_stall_timeout` error plus `[DONE]`, keeps the last good checkpoint, performs no proxy-internal replay, and cleans up exactly once (`proxy.ts`, `security.test.ts`).
  > - Never write a result or `stream_close` for a delegated exec that Cursor aborted (`proxy.ts`, `index.test.ts`).
- **Destination and classification:** `wiki/conventions/security-and-state.md` - `Convention`
- **Session evidence or selection reason:** The plan reversed the documented fail-closed invariant. Negative lifecycle tests prove exact-once termination, inert late frames, unwritable-reply failure, and abort suppression.
- **Expected future benefit:** Agents changing proxy lifecycle code check these invariants and add the required negative tests, rather than relying on the superseded fail-closed rule.
- **Why this tier:** This repository's security-and-state conventions require invariant changes to be recorded with negative tests, so the convention page is the authoritative tier.

### Metadata-only stall diagnostics

- **Exact written text:**
  > - Stall, throw, `stream_close`, abort, interaction query, and frame-count debug events carry metadata only (ids, cases, counts, timestamps, limits); interaction query and exec control frames are logged by case, not payload (`proxy.ts`, `security.test.ts`).
- **Destination and classification:** `wiki/conventions/security-and-state.md` - `Convention`
- **Session evidence or selection reason:** A debug-log test with secret query and exec payloads showed only ids, cases, counts, timestamps, and limits are written.
- **Expected future benefit:** New diagnostics extend the metadata-only rule instead of logging interaction or control payloads.
- **Why this tier:** Debug-data redaction is an existing repository convention; this extends it for the new event classes.

### Fake-bridge reply and stall test seams

- **Exact written text:**
  > - Assert client frames written to a fake bridge by decoding them as `AgentClientMessage` (for example the ordered exec reply trace of results, `throw`, and `stream_close`), not by byte snapshots. Byte-level checks are reserved for schema field-number tests in `proto.test.ts` (`index.test.ts`, `security.test.ts`).
  > - Drive the 120 s wire-idle and 180 s progress windows with fake timers and the `streamHarness` in `security.test.ts`; HTTP-level resume tests use real timers with a small `PI_CURSOR_PROGRESS_TIMEOUT_MS` via `vi.stubEnv` (`index.test.ts`, `errors.test.ts`).
- **Destination and classification:** `wiki/conventions/testing.md` - `Convention`
- **Session evidence or selection reason:** Decoded `AgentClientMessage` reply traces and fake-timer harness tests were the seams used. Byte-level checks were limited to field-number tests in `proto.test.ts`.
- **Expected future benefit:** Future protocol and lifecycle tests reuse robust decoding and timer seams instead of brittle byte snapshots or slow real-time waits.
- **Why this tier:** These are reusable testing practices across proxy work, so they belong with the testing convention and not a single-topic page.

### Stall and reply coverage routing

- **Exact written text:**
  > - Proxy requests, message reconstruction, MCP discovery, tools, checkpoints, SSE, in-band throw replies, `stream_close`, aborts, interaction queries, resume stalls, and session handling: `index.test.ts`.
  > - Stall watchdog timing, exact-once termination, unwritable-reply protocol failure, and diagnostic redaction: `security.test.ts`.
  > - Cursor error decoding and Pi-facing propagation, including stall errors being Pi-retryable: `errors.test.ts`.
  > - Snapshot refresh normalization, sanitized debug-timeline summaries, and live-smoke opt-in argument handling: `scripts.test.ts`.
- **Destination and classification:** `wiki/conventions/testing.md` - `Convention`
- **Session evidence or selection reason:** New tests were placed per suite: integration in `index.test.ts`, lifecycle and redaction in `security.test.ts`, Pi propagation in `errors.test.ts`, and smoke arguments in `scripts.test.ts`.
- **Expected future benefit:** A future change finds the right suite for reply, stall, retryability, and smoke-argument coverage without searching.
- **Why this tier:** This extends the existing coverage-by-change routing convention rather than creating a new page.

### Stall diagnostics and live smoke workflow

- **Exact written text:**
  > - `npm run debug:timeline -- --latest` reads the newest opt-in provider debug log and renders a timeline. It elevates protocol exec receipt, response/delegation, in-band throw replies, `stream_close` writes, aborts, interaction query responses and unanswered queries, unknown field metadata, watchdog expiry, protocol termination, and `STALL_TIMEOUT` (wire idle) or `PROGRESS_TIMEOUT` (no semantic progress) with limit, time since progress, and frame-class counts; it does not enable logging itself (`package.json`, `scripts/debug-log-timeline.mjs`).
  > - Stall-related runtime switches: `PI_CURSOR_PROGRESS_TIMEOUT_MS` (default 180000, `0` disables) and `PI_CURSOR_EXEC_STREAM_CLOSE` (default on, `0`/`false` disables the exec completion marker). See the README configuration table (`README.md`, `proxy.ts`).
  > - `npm run test:live -- --live [--tool | --web-search] <model...>` accesses Cursor, requires existing authentication, and sends synthetic inference requests. `--web-search` reports whether the run completed and whether a hosted web-search interaction query was observed (`not elicited` is not a failure). It must remain explicit opt-in (`scripts/smoke-live.mjs`, `scripts.test.ts`).
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Timeline tests rendered `PROGRESS_TIMEOUT` and the new events. Smoke opt-in tests and the approved `--web-search` run showed an observed interaction query.
- **Expected future benefit:** Stall investigations use the timeline fields and switches directly, and the live web-search check stays explicit opt-in, with `not elicited` not counted as failure.
- **Why this tier:** These are stable maintenance workflows for specific scripts and switches, not universal rules or tentative findings.
