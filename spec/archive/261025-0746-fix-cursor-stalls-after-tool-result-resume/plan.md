# Plan: Fix Cursor stalls after tool-result resume

Work item: `261025-0746-fix-cursor-stalls-after-tool-result-resume`
Status: Planned
Created: 2026-10-25
Updated: 2026-10-25
Assurance: medium - stateful streaming and lifecycle code on every Cursor request; reverses the documented fail-closed exec invariant; locally reversible with strong offline fake-bridge seams and no credential or ingress change.

## Goal

No Cursor-provider turn can show "Working" indefinitely. After a Pi tool result is written to the parked Cursor stream, the turn either continues or ends within a bounded no-progress window in exactly one clear, Pi-retryable error. Probable root causes, Cursor frames the proxy leaves unanswered, are removed. Legitimate long streamed reasoning is unaffected.

## Context

- Discovery and evidence: [discovery.md](./discovery.md), [research](./research/index.md).
- About 1.8% of 1,312 tool-result resumes stalled (mostly `cursor/grok-4.7-fast` in subagents): 17 ended at exactly 120 s as `Stream ended without finish_reason`, 4 were user-aborted after 13-15 min, 3 resumed after 13-29 min.
- Current mechanics at HEAD `4cea6cf` (`proxy.ts`):
  - `resetStallTimer()` resets on every Connect frame, including Cursor heartbeats (about every 10 s), and `writeSSEStream()` writes `: ping` to Pi every 15 s, so heartbeat-only waits never end.
  - On stall, `cleanupBridge()` marks the bridge disposed and the `onClose` handler returns early, closing SSE with no error and no retry.
  - `processServerMessage()` ignores `interactionQuery` and `execServerControlMessage`; `handleExecMessage()` terminates the turn with `CursorProtocolFailure` for unhandled cases; no `ExecClientControlMessage` is ever sent.
- pi-ai `isRetryableAssistantError()` retries errors containing `timeout`, `timed out`, or `ended without`; the existing no-active-bridge rebuild path recovered every observed 120 s stall.
- The vendored schema and generated binding already contain every needed message: `ExecClientControlMessage` (`streamClose`, `throw`), `ExecServerControlMessage.abort`, `InteractionQuery`, `InteractionResponse`, and the approve/reject result schemas.
- Reference encodings for interaction responses: oh-my-pi `packages/ai/src/providers/cursor/interaction-query.ts` at commit `0b5c27ab24719c86a5986b95ee55f4e75bc1aaa0` (evidence only, not a dependency).
- Baseline: `npm run check` passes (typecheck plus 544 tests) on 2026-10-25.

## Requirements

### R1 In-band answers for every answerable Cursor frame

- Any exec the proxy cannot answer or delegate, including an undefined oneof and an `mcpArgs` whose arguments cannot be decoded, receives `ExecClientControlMessage.throw{id, error}` with a short sanitized error, and the turn continues.
- `CursorProtocolFailure` termination remains only when a reply frame cannot be written.
- The existing control-exec watchdog remains as a safety net and is cleared by throw replies the same way it is cleared by typed results.
- `interactionQuery` responses use `InteractionResponse{id}`:
  - `webSearchRequestQuery`, `webFetchRequestQuery`, `exaSearchRequestQuery`, `exaFetchRequestQuery`: approved.
  - `askQuestionInteractionQuery`: `AskQuestionResult.rejected{reason}` pointing to Pi tools.
  - `switchModeRequestQuery`: `rejected{reason}`.
  - `createPlanRequestQuery`: `CreatePlanResult.error{error}`.
  - `setupVmEnvironmentArgs` and undefined query cases: no reply; record a sanitized debug event. The no-progress watchdog bounds the wait.
- `execServerControlMessage.abort{id}` clears any control-watchdog entry for that id. If the id matches a delegated `mcpArgs` awaiting Pi, the provider marks it aborted and does not write its `mcpResult` (or `stream_close`) on resume; other pending results are unaffected.
- The shared frame handling applies to both streaming and non-streaming paths.

### R2 Exec reply completion marker

- After every exec reply the proxy writes (delegated `mcpResult` on resume, native-tool rejections, control-exec results such as request context and MCP state, and R1 throw replies), write `ExecClientControlMessage.streamClose{id}` for the same exec message id.
- Enabled by default. `PI_CURSOR_EXEC_STREAM_CLOSE=0` (also `false`) disables it.
- Do not send per-exec `ExecClientHeartbeat`.

### R3 Semantic-progress watchdog and explicit stall termination (streaming path)

- Add a no-progress timer in `writeSSEStream()` for fresh turns and tool-result resumes, independent of the existing wire-idle stall timer.
- Progress: non-empty text or thinking deltas, `tokenDelta`, tool-call events (`toolCallStarted`, `partialToolCall`, `toolCallDelta`, `toolCallCompleted`), `thinkingCompleted`, `stepStarted`, `stepCompleted`, summary events, `turnEnded`, KV blob exchanges, checkpoint updates, exec frames that are answered or delegated, abort control frames, and answered interaction queries.
- Not progress: heartbeats, empty deltas, unanswered interaction queries, and unrecognized update or message cases.
- Default 180,000 ms from `PI_CURSOR_PROGRESS_TIMEOUT_MS`. `0` disables it; empty, negative, or non-numeric values use the default.
- On expiry, and on the existing wire-idle stall expiry, send exactly one SSE error `{ error: { message, type: "upstream_error", code: "cursor_stall_timeout" } }` whose message contains `timeout` and names the elapsed limit, then `[DONE]`, close the response, and clean the bridge, timers, listeners, `sessionBridges`, and `activeBridges` exactly once.
- No proxy-internal replay after a stall. Keep the last good checkpoint. Late frames and close callbacks after termination stay inert.
- Keep the 15 s `: ping` SSE keepalive and existing transparent retry before content for bridge exits and retryable Connect errors.

### R4 Opt-in stall diagnostics

- When `PI_CURSOR_PROVIDER_DEBUG` is enabled, record per-stream frame-class counts, last-progress timestamp, stall reason (`progress_timeout` or `wire_idle`), unanswered interaction query cases, throw replies, stream-close writes, and abort handling.
- Metadata only: no prompts, tool arguments, credentials, or raw unknown bytes.
- `scripts/debug-log-timeline.mjs` elevates `PROGRESS_TIMEOUT` alongside `STALL_TIMEOUT` and summarizes the new events.
- No new always-on output.

### R5 Live smoke support

- Add a `--web-search` mode to `scripts/smoke-live.mjs` that sends a synthetic prompt likely to trigger Cursor's hosted web search and reports whether the run completed and whether an interaction query was observed. It remains explicit opt-in and synthetic-only.

### R6 Documentation and durable knowledge

- README configuration table documents `PI_CURSOR_PROGRESS_TIMEOUT_MS` and `PI_CURSOR_EXEC_STREAM_CLOSE`, the stall error, and interaction query policy.
- Update `wiki/architecture.md`, `wiki/conventions/security-and-state.md`, `wiki/conventions/testing.md` if seams change, `wiki/development.md`, `wiki/log.md`, and `wiki/state.md` to replace fail-closed exec termination with in-band replies and document R1-R4.

## Out of scope

- Switching providers, hand-off or one-Run-per-turn continuation, and proxy-internal replay after a tool-result resume.
- Per-exec `ExecClientHeartbeat`, always-on diagnostics, and a no-progress watchdog for the non-streaming path.
- pi-interactive-subagents changes, model reasoning length, schema regeneration, and unrelated proxy refactors.
- Commits, pushes, `pi update`, and publishing without separate approval.

## Assumptions

- `stream_close` after typed results is accepted by Cursor (pi-cursor-reins live note; Cursor's executor sends it after throw). Revisit if the live smoke tool round trip fails with it enabled: ship with `PI_CURSOR_EXEC_STREAM_CLOSE` defaulting off and record the finding.
- `setupVmEnvironmentArgs` does not occur in local Pi usage. Revisit if debug logs show it.
- The SSE error format already used for protocol failures surfaces as the Pi assistant `errorMessage`, so a message containing `timeout` is retried by Pi. `errors.test.ts` covers Pi-facing propagation.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Architecture | Keep and harden the parked-stream continuation. | Smallest change; preserves latency and checkpoint continuity. | discovery D01 | Post-rollout stall rate stays material; open a hand-off item. |
| D02 | Exec dispatch | Unanswerable execs get in-band `throw` and the turn continues. | Matches Cursor's executor and oh-my-pi; reverses fail-closed invariant. | discovery D02 | Cursor rejects or loops on throw replies. |
| D03 | Interaction | Approve web search, web fetch, Exa search, Exa fetch; reject ask-question and switch-mode; error create-plan; leave VM setup and unknown queries unanswered. | User preference; no truthful VM-setup reply exists. | discovery D03, D08; oh-my-pi encodings | Hosted web access misbehaves or VM setup appears. |
| D04 | Stall outcome | One explicit Pi-retryable SSE error; no internal replay. | Reuses proven Pi retry and rebuild path. | discovery D04 | Pi retry patterns change or rebuild proves lossy. |
| D05 | Diagnostics | Opt-in debug log and timeline only. | User preference. | discovery D05 | Residual stalls remain undiagnosable. |
| D09 | Watchdog | 180 s no-progress default via `PI_CURSOR_PROGRESS_TIMEOUT_MS`; heartbeats excluded. | Bounds stalls without affecting streamed reasoning. | discovery D09 | False positives or slow recovery. |
| D11 | Exec control | `streamClose{id}` after every exec reply, default on, `PI_CURSOR_EXEC_STREAM_CLOSE=0` disables; no per-exec heartbeat. | Leading root-cause hypothesis; zero token cost; off switch bounds risk. | discovery D11 | Live smoke regression or stalls correlate with long tools. |
| D12 | Completion gates | Implementation completes on offline checks plus authorized live smoke; the post-rollout session scan gates archival. | The scan needs real usage after release. | Confirmed in To Spec preview 2026-10-25 | User waives the scan. |
| D14 | Completion gates (supersedes D12 archival gate) | User waived the D12 post-rollout session scan on 2026-10-25. Old gate: archive only after a post-rollout session scan. New gate: archive after offline checks, both medium-assurance reviews, and both approved live smokes. | Explicit user authorization (D12's own revisit condition). Consequence: no post-rollout stall-rate comparison against the 1.8% baseline will be recorded for this item. | User authorization relayed by the orchestrator, 2026-10-25; [verification.md](./verification.md) | Stalls recur after release; open a new item using the discovery JSONL scan method. |
| D13 | Implementation detail (R1) | "`mcpArgs` arguments cannot be decoded" means an argument value that is neither a protobuf `Value` nor valid UTF-8 (fatal decoder); such execs get the R1 throw instead of delegating replacement-character text to Pi. The progress watchdog re-arms on each transparent bridge retry, and no timers run on a parked (tool-paused) writer. | Previously decoding could not fail, so R1's undecodable case was unreachable; parked waits are bounded by Pi, not the proxy. | Implementation 2026-10-25; `index.test.ts`, `security.test.ts` | Cursor sends legitimate non-UTF-8 raw argument bytes. |

## Work breakdown

- [x] T01: Answer every answerable Cursor frame in band (R1).
  - Depends on: none
  - Expected areas: `proxy.ts` (`processServerMessage`, `handleExecMessage`, `handleToolResultResume`, non-streaming handler, control-exec lifecycle)
  - Acceptance: R1 behaviors hold; reply-write failure is the only remaining protocol termination.
- [x] T02: Exec reply completion marker (R2).
  - Depends on: T01
  - Expected areas: `proxy.ts` exec reply helpers and resume path
  - Acceptance: `streamClose{id}` follows every exec reply when enabled and is absent when disabled.
- [x] T03: Semantic-progress watchdog and explicit stall termination (R3).
  - Depends on: T01
  - Expected areas: `proxy.ts` (`writeSSEStream`, stall timer, `onClose`, frame classification)
  - Acceptance: heartbeat-only waits end in one `cursor_stall_timeout` error within the window; wire-idle stalls emit the same explicit error; streamed reasoning past the window does not time out; cleanup is exact-once.
- [x] T04: Opt-in stall diagnostics (R4).
  - Depends on: T01, T03
  - Expected areas: `proxy.ts` debug events, `scripts/debug-log-timeline.mjs`
  - Acceptance: timeline shows `PROGRESS_TIMEOUT` and new metadata without sensitive payloads.
- [x] T05: Tests for T01-T04.
  - Depends on: T01-T04
  - Expected areas: `index.test.ts`, `security.test.ts`, `proto.test.ts`, `scripts.test.ts`
  - Acceptance: see Acceptance criteria; replaced fail-closed expectations are intentional and documented in the diff.
- [x] T06: Live smoke web-search mode (R5).
  - Depends on: T01, T02
  - Expected areas: `scripts/smoke-live.mjs`, `scripts.test.ts` if argument handling is covered
  - Acceptance: offline argument and opt-in behavior unchanged; live run only after explicit approval.
- [x] T07: Documentation and wiki (R6).
  - Depends on: T01-T06
  - Expected areas: `README.md`, `wiki/`
  - Acceptance: docs match implemented behavior and environment variables.

## Acceptance criteria

- `npm run check` passes.
- Fake-bridge tests prove:
  - unhandled, undefined, and undecodable-`mcpArgs` execs each receive exactly one `throw` reply and the stream continues;
  - each interaction query case receives exactly one correctly typed response, and VM setup and unknown cases receive none;
  - abort of a delegated exec suppresses its result on resume without affecting other pending results;
  - `streamClose{id}` follows every exec reply type when enabled and is absent with `PI_CURSOR_EXEC_STREAM_CLOSE=0`;
  - heartbeat-only periods, both fresh and after resume, end in exactly one SSE error with code `cursor_stall_timeout` and `timeout` in the message, followed by `[DONE]`, with bridge, timers, listeners, and maps cleaned once;
  - the wire-idle stall path emits the same explicit error instead of a bare close;
  - continuous thinking or token deltas beyond the window do not time out;
  - `PI_CURSOR_PROGRESS_TIMEOUT_MS=0` disables the watchdog and invalid values fall back to 180 s;
  - late frames after termination are inert.
- The debug timeline test renders `PROGRESS_TIMEOUT` and new metadata, with no prompt, argument, credential, or raw-byte leakage.
- After explicit user approval, the live smoke (`node scripts/smoke-live.mjs --live --tool grok-4.7-fast` and the `--web-search` run) completes without stall or error with the stream-close marker enabled. A web-search run that elicits no interaction query is recorded as not elicited, not failed.
- Archival gate (D12): a post-rollout session scan using the discovery JSONL method shows no indefinite hangs and no `Stream ended without finish_reason` for Cursor turns, compared with the 1.8% baseline.

## Testing decisions and seams

- Use `setBridgeFactoryForTests` and `__testInternals` with synthetic Connect frames built from the generated schemas; use fake timers for the 180 s and 120 s windows.
- Assert written client frames by decoding them as `AgentClientMessage` rather than byte snapshots.
- Lifecycle and invariant changes need negative tests in `security.test.ts` (`wiki/conventions/security-and-state.md`).

## Verification plan

- Focused: `npx vitest run index.test.ts security.test.ts proto.test.ts scripts.test.ts errors.test.ts`.
- Full: `npm run check`.
- Package: `HOME="$(mktemp -d)" node scripts/smoke-package.mjs`.
- Live, only after explicit approval: `node scripts/smoke-live.mjs --live --tool grok-4.7-fast` and `node scripts/smoke-live.mjs --live --web-search grok-4.7-fast`.
- Spec: `uv run spec/scripts/manage-spec-item.py --root . validate --item 261025-0746-fix-cursor-stalls-after-tool-result-resume`.
- Reviews (medium assurance): one coherent-boundary review after T01-T05 and one final contract-quality review against this plan before completion.
- Post-rollout: rerun the session scan after real subagent usage and record it in `verification.md` before archival.

## Risks and blockers

- Cursor could misinterpret `streamClose` after typed results and break tool continuation. Mitigation: live smoke before rollout and the environment off switch.
- Throw replies could make a model retry a rejected action in a loop. Mitigation: the no-progress watchdog still bounds silent loops; visible loops are recorded via debug events.
- A legitimately silent pre-token phase longer than 180 s on very large contexts would time out. Mitigation: KV and checkpoint traffic count as progress, and the limit is configurable.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T07), 2026-10-25.
- [x] Verification: offline checks, focused and final contract-quality reviews (PASS), and both approved live smoke runs (PASS). See [verification.md](./verification.md).
- [x] Post-rollout session scan (D12): waived by the user on 2026-10-25 (D14). Not performed, so no stall-rate comparison is recorded.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, live Cursor smoke runs, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- Architecture and security-state wiki pages: in-band throw replies replace fail-closed termination; interaction query policy; `streamClose`; semantic-progress watchdog; explicit retryable stall errors.
- Development wiki and README: new environment variables, timeline events, and the `--web-search` live smoke mode.
