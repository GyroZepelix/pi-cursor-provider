# Outcome: Fix Cursor stalls after tool-result resume

Work item: `261025-0746-fix-cursor-stalls-after-tool-result-resume`
Disposition: completed
Date: 2026-10-25

## Delivered scope

- R1: The proxy now answers every answerable Cursor frame in band.
  - Execs it cannot answer or delegate get `ExecClientThrow` with a short sanitized error, and the turn continues. These are unknown oneof cases, decoded-but-unsupported cases, and `mcpArgs` whose arguments are neither a protobuf `Value` nor UTF-8.
  - Only an unwritable reply still terminates with `cursor_protocol_error`.
  - Interaction queries: web search, web fetch, and Exa search/fetch are approved. Ask-question and switch-mode are rejected. Create-plan returns an error. VM setup and unknown queries are left unanswered.
  - `ExecServerControlMessage.abort` clears the control watchdog. An aborted delegated result is never written on resume.
- R2: `ExecClientControlMessage.stream_close{id}` follows every exec reply. It is on by default; `PI_CURSOR_EXEC_STREAM_CLOSE=0|false` disables it.
- R3: Streaming turns have a semantic-progress watchdog.
  - `PI_CURSOR_PROGRESS_TIMEOUT_MS`, default 180 s; `0` disables. Heartbeats do not count as progress.
  - Both no-progress and wire-idle stalls emit exactly one Pi-retryable `cursor_stall_timeout` error, then `[DONE]`.
  - Cleanup is exact-once, there is no internal replay, and the last good checkpoint is kept.
- R4: Opt-in, metadata-only diagnostics: frame-class counts, stall reason, throw, `stream_close`, abort, and query events. `scripts/debug-log-timeline.mjs` shows `PROGRESS_TIMEOUT`.
- R5: `scripts/smoke-live.mjs --web-search` mode.
- R6: README and wiki updated.

## Deviations from plan

- D13 is an implementation detail. It defines R1's "undecodable `mcpArgs`" as fatal-UTF-8-and-not-`Value`. The progress watchdog re-arms on transparent retry and does not run on a parked (tool-paused) writer.
- D14: the user waived the D12 post-rollout session scan on 2026-10-25. Archival proceeded after offline checks, both reviews, and both approved live smokes. No post-rollout stall-rate comparison against the 1.8% baseline is recorded.
- The 5 former fail-closed tests were intentionally replaced by in-band reply tests.

## Verification summary

- `npm run check` passes: tsc plus 586 tests (baseline was 544).
- Focused test files pass, the package smoke passes, spec validate passes, and `git diff --check` passes.
- Mutation sanity checks were caught by the tests.
- Medium-assurance reviews:
  - Focused T01-T05: PASS.
  - Final contract-quality T01-T07: PASS.
  - Neither had blockers. Non-blocking notes were applied, and 0 re-reviews were used.
- Approved live smokes on `grok-4.7-fast` with `stream_close` enabled:
  - Tool replay: PASS.
  - Web search: PASS, with one `webSearchRequestQuery` observed and approved.
- Details: [verification.md](./verification.md).

## Retained, reverted, or transferred work

- All changes are retained as uncommitted working-tree edits on top of `4cea6cf`. Committing, publishing, and `pi update` remain separate user-controlled steps.
- No CHANGELOG or version change was made; that is release scope.

## Residual risks

- The effect on the real stall rate is unmeasured because the scan was waived.
- Live `stream_close` acceptance was proven on one model and one tool round trip only. If it regresses, set `PI_CURSOR_EXEC_STREAM_CLOSE=0`.
- Throw replies could induce visible model retry loops. These are bounded by the progress watchdog and visible in debug logs.
- A legitimately silent pre-token phase longer than 180 s would time out. The limit is configurable.

## Follow-up work items

- None opened. If stalls recur after release, open a new item and use the discovery JSONL session-scan method. This item's D01 revisit condition covers a possible hand-off architecture.
- Release notes (CHANGELOG) and a version bump are left to the next release.

## Source references

- `proxy.ts`, `scripts/debug-log-timeline.mjs`, `scripts/smoke-live.mjs`, `README.md`.
- Tests: `index.test.ts`, `security.test.ts`, `proto.test.ts`, `errors.test.ts`, `scripts.test.ts`.
- [plan.md](./plan.md), [discovery.md](./discovery.md), [research](./research/index.md), [verification.md](./verification.md).

## Wiki updates

- `wiki/architecture.md`, `wiki/conventions/security-and-state.md`, `wiki/conventions/testing.md`, and `wiki/development.md` were updated to document in-band replies, interaction policy, `stream_close`, abort handling, the progress watchdog, the explicit stall error, diagnostics, and the `--web-search` smoke.
- `wiki/log.md` and `wiki/state.md` record this focused ingest.
