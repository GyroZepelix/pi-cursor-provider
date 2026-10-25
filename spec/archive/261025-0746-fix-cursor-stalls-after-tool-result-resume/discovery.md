# Discovery: Fix Cursor stalls after tool-result resume

Work item: `261025-0746-fix-cursor-stalls-after-tool-result-resume`
Status: Ready for spec
Created: 2026-10-25
Updated: 2026-10-25

Assurance: medium (user-confirmed 2026-10-25) - stateful streaming and lifecycle code on every Cursor request; changes reverse a documented fail-closed exec invariant; locally reversible package with strong offline test seams and no credential or ingress change.

## Objective

Stop Cursor-provider turns (mostly `cursor/grok-4.7-fast` in Pi subagents) from stalling indefinitely or failing ambiguously after a Pi tool result is sent back on the parked Cursor stream.

## Desired outcome

- No Cursor turn can show "Working" indefinitely: every request reaches a terminal event within a bounded no-progress window.
- Stalls that do occur end in a recoverable, clearly worded, Pi-retryable error or a transparent recovery, never `Stream ended without finish_reason`.
- Probable root causes (unanswered Cursor protocol frames) are removed.
- The next residual stall is diagnosable without full prompt-bearing debug logs.
- Legitimate long reasoning (3-5 min at 45-60 tok/s) is unaffected.

## Repository and domain context

- Fact: Pi loads `index.ts`; `proxy.ts` is a loopback OpenAI-compatible proxy translating to Cursor `agent.v1.AgentService/Run` through the `h2-bridge.mjs` child process (`wiki/architecture.md`).
- Fact: Tool continuations reuse the live bridge: on `mcpArgs` the proxy emits an OpenAI tool call, closes SSE, and parks the bridge in `activeBridges`; the next Pi request writes `mcpResult` on the same stream (`handleToolResultResume`, `proxy.ts`).
- Fact: The prior item `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze` established fail-closed exec dispatch, a control-exec watchdog not reset by heartbeats (excluding delegated `mcpArgs`), and pinned the oh-my-pi schema.
- Fact: Pi runs the installed copy at `~/.pi/agent/git/github.com/GyroZepelix/pi-cursor-provider`; this dev checkout is the source of change.
- Fact: Baseline `npm run check` passes (typecheck plus 544 Vitest tests) at HEAD `4cea6cf` on 2026-10-25.

## Scope

- Keep the parked-stream continuation architecture and harden it (D01).
- Answer every Cursor frame that can block a turn: unhandled exec cases (D02), interaction queries (D03), exec abort control messages.
- Add a semantic-progress watchdog not reset by heartbeats; convert every stall outcome into one explicit Pi-retryable SSE error (D04).
- Extend the existing opt-in debug log and timeline with stall-relevant metadata only (D05).
- Validate with offline tests, an authorized live smoke, and a post-rollout session scan (D06).

## Out of scope

- Switching to another Cursor provider package (user decision 2026-10-25: improve this fork instead).
- Model-side long reasoning behavior.
- pi-interactive-subagents changes (it does not touch provider streaming).
- Hand-off or one-Run-per-turn continuation (rejected for now; see Rejected alternatives).
- Proxy-internal transparent replay after a tool-result resume.
- New always-on diagnostics output.

## Confirmed facts and evidence

See [research/stall-evidence-and-reference-clients.md](./research/stall-evidence-and-reference-clients.md). Key points:

- About 1.8% of 1,312 tool-result resumes stalled: 17 ended at exactly 120 s with `Stream ended without finish_reason`; 4 were user-aborted after 13-15 min; 3 resumed after 13-29 min.
- `resetStallTimer()` resets on every frame including heartbeats; Pi receives `: ping` every 15 s; so heartbeat-only periods never terminate.
- Stall kill disposes the bridge and `onClose` returns before retry or SSE error.
- `interactionQuery` and `execServerControlMessage` are ignored; unhandled exec cases terminate the turn; no `ExecClientControlMessage` is ever sent.
- Pi auto-retries assistant errors matching `timeout`, `timed out`, `ended without`, `connection lost`, `terminated`; the existing no-active-bridge path rebuilt successfully after the 120 s errors.
- Hypothesis: Cursor waits for `stream_close{id}` and/or per-exec heartbeats around delegated `mcpArgs` (reins live note); oh-my-pi does not send `stream_close` after typed results, so this is unconfirmed.

## Constraints and invariants

- Retry only before content reaches the client; never duplicate partial output (`wiki/conventions/security-and-state.md`).
- Late callbacks after disposal, shutdown, or protocol failure stay inert; cleanup runs exactly once.
- Debug data stays opt-in when it can contain prompts; diagnostics must not log prompts, credentials, or raw unknown bytes.
- Lifecycle changes need negative tests in `security.test.ts` plus behavior tests in `index.test.ts`; no live Cursor traffic in unit tests.
- Generated `proto/agent_pb.ts` is not hand-edited; the vendored schema already contains `ExecClientControlMessage`, `InteractionQuery`, and `InteractionResponse`.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D00 | Fix this fork rather than switch providers. | User direction. | Conversation 2026-10-25 | Fixes fail to reduce the stall rate. |
| D01 | Keep and harden the parked-stream tool continuation. | Smallest change; preserves latency and checkpoint continuity; watchdog bounds residual stalls. | Round 1 Q1 | Post-rollout stall rate stays material; then open a hand-off item. |
| D02 | Answer unhandled exec cases in band with `ExecClientControlMessage.throw{id, error}` and continue the turn, replacing terminal `CursorProtocolFailure` for those cases. | Matches Cursor's own executor and oh-my-pi; new Cursor exec kinds no longer kill turns. Reverses the documented fail-closed invariant, so wiki and security tests must change. | Round 1 Q2; oh-my-pi `sendExecClientThrow` | Cursor rejects throw replies or loops on them. |
| D03 | Answer `InteractionQuery`: approve web search and web fetch; reject ask-question, switch-mode, and create-plan with guidance to use Pi tools. | User preference for Cursor-hosted web access; other queries conflict with Pi control flow. | Round 1 Q3 | Hosted web results misbehave or raise policy concerns. |
| D04 | On no-progress timeout, and on the existing wire-idle stall, emit exactly one explicit SSE error whose text matches Pi's retry patterns (for example containing `timeout`), then clean up once. No proxy-internal replay after resume. | Reuses Pi auto-retry plus the existing no-active-bridge rebuild path that already recovered the 120 s stalls; avoids unsafe replay. | Round 1 Q4; pi-ai `RETRYABLE_PROVIDER_ERROR_PATTERN`; session evidence | Pi retry stops matching or the rebuild path proves lossy. |
| D05 | No new always-on diagnostics; add stall-relevant metadata events (frame-class counts, last-progress time, stall reason, unanswered frame cases) to the existing opt-in debug log and `debug:timeline`. | User preference to avoid new persistent output. | Round 1 Q5 | Residual stalls remain undiagnosable. |
| D06 | Acceptance requires offline tests, an authorized synthetic live smoke against Cursor, and a post-rollout session scan. | User chose stronger evidence than tests alone. | Round 1 Q6 | Live access unavailable. |
| D07 | Assurance is medium. | User confirmed recommendation. | Round 1 Q7 | Scope grows into architecture change. |
| D08 | Also approve Exa search and Exa fetch interaction queries. | Same Cursor-hosted web-access class as D03; keeps one simple rule. | Round 2 Q2 | Same as D03. |
| D09 | One no-progress timeout of 180 s for fresh turns and post-tool-result resumes, adjustable by an environment variable. Heartbeats never reset it; text, thinking, token deltas, tool events, checkpoints, KV exchanges, and answered exec/interaction frames do. | Bounds stalls at 3 min instead of 13-30 min while leaving legitimate streamed reasoning untouched. | Round 2 Q3; session throughput evidence | False positives on slow first tokens, or stalls still too slow to recover. |
| D10 | Live smoke covers one `cursor/grok-4.7-fast` Pi tool round trip and one prompt that triggers a web-search interaction query, via `scripts/smoke-live.mjs` with synthetic prompts. | Proves new control frames do not break continuation and that query approval works. | Round 2 Q4 | Smoke cannot elicit a web-search query reliably. |
| D11 | Send `ExecClientControlMessage.stream_close{id}` after every exec reply the proxy writes (delegated `mcpResult`, native-tool rejections, control-exec results, and D02 throw replies). On by default; one environment variable disables it. Do not send per-exec `ExecClientHeartbeat`. | Leading hypothesis for post-result stalls (instant tools, heartbeat-only waits); Cursor's executor and reins' live notes send it; zero token cost; off switch bounds regression risk. Per-exec heartbeat lacks supporting evidence (stalls followed ~0 s tools). | Round 2 Q1; research file | Live smoke shows regression, or stalls later correlate with long-running Pi tools (then revisit per-exec heartbeat). |

## Rejected alternatives

- Hand-off or one-Run-per-turn continuation (oh-my-pi external-executor style): removes parked-stream stalls by construction but rewrites continuation and checkpoint replay; deferred behind D01's revisit condition.
- Proxy-internal replay after resume: `writeSSEStream` retry rebuilds from `currentTurn.userText` and the pre-turn checkpoint without the in-flight tool steps, so replay after resume risks lost or duplicated tool context.

## Open questions and prerequisites

- Fact: `SetupVmEnvironmentResult` has only a `success` case and `AskQuestionInteractionResponse` / `CreatePlanRequestResponse` wrap result messages rather than approve/reject oneofs; exact reject encodings are a planning detail to verify against the schema and oh-my-pi `cursor/interaction-query.ts`.

## Current frontier

Empty. Rounds 1 and 2 settled D01-D11. User confirmed the shared-understanding synthesis on 2026-10-25 by invoking To Spec.

## Research index

- [Research index](./research/index.md)

## Proposed test seams and acceptance evidence

- Fake-bridge tests via `setBridgeFactoryForTests` and `__testInternals` (`index.test.ts`, `security.test.ts`):
  - heartbeat-only periods (fresh and after resume) end in exactly one Pi-retryable SSE error within the configured no-progress window, with cleanup and map emptiness asserted;
  - continuous thinking or token deltas past the window do not time out;
  - the wire-idle stall path now emits the same explicit error instead of a bare close;
  - unhandled exec cases receive one `throw` reply and the stream continues;
  - each interaction query case receives exactly one correctly typed approve or reject response;
  - `stream_close{id}` follows every exec reply when enabled and is absent when disabled;
  - exec abort control messages are handled without errors or leaks;
  - updated negative tests replacing the fail-closed termination expectations.
- Debug timeline renders new stall metadata (`scripts.test.ts`).
- `npm run check` green.
- Authorized live smoke per D10.
- Post-rollout session scan using the same JSONL method against the 1.8% baseline: no indefinite hangs and no `Stream ended without finish_reason`.

## Proposed wiki updates after implementation

- `wiki/architecture.md` and `wiki/conventions/security-and-state.md`: replace fail-closed exec termination with in-band throw replies, document interaction query policy, `stream_close`, the no-progress watchdog, and explicit retryable stall errors.
- `wiki/development.md` / README configuration table: new environment variables and timeline events.

## Resume state

Rounds 1 and 2 answered and persisted 2026-10-25 (R2-Q1 required two clarifications: control frames are protocol bytes with no token cost). Synthesis confirmed 2026-10-25. Next action: `/skill:to-spec 261025-0746-fix-cursor-stalls-after-tool-result-resume`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
