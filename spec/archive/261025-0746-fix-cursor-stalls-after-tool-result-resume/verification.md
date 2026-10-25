# Verification: Fix Cursor stalls after tool-result resume

Work item: `261025-0746-fix-cursor-stalls-after-tool-result-resume`
Date: 2026-10-25

## Environment

- Mode: direct. Assurance: medium (stateful streaming and lifecycle code on every Cursor request; reverses the fail-closed exec invariant; locally reversible with offline fake-bridge seams; no credential or ingress change).
- Starting boundary: HEAD `4cea6cf99ea5ef739179cd4d358a143e7c0abdfe`; no commits during implementation. All changes are unstaged working-tree edits plus the untracked item folder. Pre-existing dirty paths at start were item-owned only (`spec/index.md` planned row, item files).
- Changed paths: `proxy.ts`, `index.test.ts`, `security.test.ts`, `proto.test.ts`, `errors.test.ts`, `scripts.test.ts`, `scripts/debug-log-timeline.mjs`, `scripts/smoke-live.mjs`, `README.md`, `wiki/architecture.md`, `wiki/conventions/security-and-state.md`, `wiki/conventions/testing.md`, `wiki/development.md`, `wiki/log.md`, `wiki/state.md`, and this item's `plan.md` (Decision Log D13 and progress) and `verification.md`.
- Node per `package.json` engines; offline only. No dependency, schema, or generated-binding change.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline `npm run check` (before change) | PASS | tsc plus 544 tests |
| `npx vitest run index.test.ts security.test.ts proto.test.ts scripts.test.ts errors.test.ts` | PASS | 5 files; all tests passed (re-run by both reviewers) |
| `npm run check` (final) | PASS | tsc clean; 8 files, 586 tests |
| `HOME="$(mktemp -d)" node scripts/smoke-package.mjs` | PASS | `{"ok":true,"models":54,"authentication":"enforced","privacyLabel":"preserved","externalFetches":0}`, exit 0 |
| `uv run spec/scripts/manage-spec-item.py --root . validate --item 261025-0746-fix-cursor-stalls-after-tool-result-resume` | PASS | `"valid": true` |
| `git diff --check` | PASS | no whitespace errors |
| Markdown fence balance, ASCII in new wiki text | PASS | only pre-existing README em dashes on edited lines |
| Mutation sanity (temporary, reverted, `cmp` confirmed) | PASS | Each regression made tests fail: heartbeats counted as progress, the aborted flag ignored, wire-idle reverted to bare cleanup, and no progress re-arm on retry. |
| Live smoke `node scripts/smoke-live.mjs --live --tool grok-4.7-fast` (user-approved 2026-10-25, once, `stream_close` enabled by default) | PASS | exit 0. Tool-replay `ok: true`, `stopReason: stop`, `streamed: true`, `totalTokens: 7976`. The tool round trip completed with `stream_close` after the resumed `mcpResult`. |
| Live smoke `node scripts/smoke-live.mjs --live --web-search grok-4.7-fast` (user-approved 2026-10-25, once) | PASS | exit 0. Web-search `ok: true`, `stopReason: stop`, `streamed: true`, `totalTokens: 12789`. `interactionQueries: {webSearchRequestQuery: 1}`, `interactionQuery: observed`: the approved hosted search completed. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 throw for unanswerable execs, turn continues | `index.test.ts` "proxy hang fixes" covers unknown, decoded-unsupported, and undecodable `mcpArgs` x stream/non-stream: one `throw` then `streamClose`, turn completes, sanitized text. `security.test.ts` covers the sanitized throw plus metadata-only log. | PASS |
| R1 protocol failure only on unwritable reply | `security.test.ts` "a reply frame that cannot be written still terminates once with a protocol error" | PASS |
| R1 watchdog cleared by throw and abort | `security.test.ts` "control exec watchdog" (`onResponse(..., "throw")`, `onAbort`) | PASS |
| R1 interaction query policy | `index.test.ts` interaction query `test.each`: 7 typed responses with correct result cases; VM setup and unknown get none | PASS |
| R1 abort of delegated exec | `index.test.ts` "abort of a delegated exec suppresses only its result on resume" | PASS |
| R1 shared streaming and non-streaming handling | Non-stream variants of the throw tests; non-stream rejection test | PASS |
| R2 `streamClose` after every reply; env off switch | `index.test.ts` `stream_close` `test.each` (unset/`1` on; `0`/`false` off) over request context, native rejection, throw, MCP state, and resumed `mcpResult`. Also the non-stream rejection test and the `proto.test.ts` field-number bytes. | PASS |
| R3 heartbeat-only stall, fresh and after resume | `security.test.ts` heartbeat-only (fake timers, 180 s); `index.test.ts` resume stall (150 ms) | PASS |
| R3 wire-idle explicit error | `security.test.ts` "wire-idle stall emits the same explicit error" | PASS |
| R3 continuous progress does not time out | `security.test.ts` continuous reasoning and token-delta cases (400 s) | PASS |
| R3 env parsing (`0` disables; invalid uses default) | `security.test.ts` `PI_CURSOR_PROGRESS_TIMEOUT_MS` parse cases plus the disabled case | PASS |
| R3 exact-once cleanup, late frames inert, no replay, checkpoint kept | Heartbeat-only test asserts one error, one `[DONE]`, one end, one cancel, listeners, maps, and timers, plus late frame, late close, and client close. Parked-writer and retry re-arm tests are also included. | PASS |
| R3 Pi-retryable error | `errors.test.ts`: real Pi transport `errorMessage` "Cursor stream timeout: no progress for 100ms", `isRetryableAssistantError` true | PASS |
| R4 opt-in metadata-only diagnostics and timeline | `security.test.ts` debug diagnostics test (no payload leak); `scripts.test.ts` `PROGRESS_TIMEOUT` and new-event timeline test | PASS |
| R5 `--web-search` smoke mode, opt-in unchanged | `scripts.test.ts` "live smoke opt-in" (refuses without `--live`; `--tool` and `--web-search` exclusive); approved live run observed one interaction query | PASS |
| R6 README and wiki | README config table, stall error, interaction policy, smoke mode, timeline; wiki architecture, security-and-state, testing, development, log, state | PASS (reviewed) |

## Review findings

- Focused review (T01-T05, medium coherent boundary): PASS, 0 blockers. Non-blocking notes:
  - The progress timer stayed armed on a retryable Connect end-stream. Applied: it is now cleared on any end-stream and re-armed by retry.
  - The token-progress case was not tested. Applied: a `tokenDelta` case was added.
- Final contract-quality review (T01-T07): PASS, 0 blockers. Non-blocking notes:
  - Wiki cited `verification.md` before it existed. Resolved by this file.
  - D13 retry re-arm and parked-writer timer behavior lacked direct tests. Applied: two `security.test.ts` tests were added, and the retry test was mutation-checked.
- Review retries used: 0 of 2.

## Failures and skipped checks

- No failing checks. The only expected failures were the 5 former fail-closed tests, which were intentionally replaced: `index.test.ts` "proxy hang fixes" and the `security.test.ts` unknown-exec test.
- None skipped. Both live smoke runs were explicitly approved and run once each. No credential material was printed or recorded, and no other live runs or models were used. The D11 fallback was not needed.

## Unverified areas

- Live acceptance of `stream_close` covers one model (`grok-4.7-fast`) and one tool round trip. Other models and long multi-tool turns rely on the post-rollout scan.
- Whether the change lowers the 1.8% stall baseline is unverified. The user waived the D12 post-rollout session scan on 2026-10-25 (plan D14), so archival no longer depends on it and no post-rollout stall-rate comparison will be recorded for this item.
- `setupVmEnvironmentArgs` is assumed absent in local Pi usage. Unanswered queries are visible in opt-in debug logs.
