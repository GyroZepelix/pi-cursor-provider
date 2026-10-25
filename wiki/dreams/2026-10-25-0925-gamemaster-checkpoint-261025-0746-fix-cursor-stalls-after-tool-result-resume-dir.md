---
schema_version: 1
episode_id: "2026-10-25-0925-gamemaster-checkpoint-261025-0746-fix-cursor-stalls-after-tool-result-resume-dir"
timestamp: "2026-10-25T09:25:55+01:00"
summary: "Bounded Cursor tool-result-resume stalls with in-band exec and interaction replies, stream_close markers, a semantic-progress watchdog, and one Pi-retryable stall error."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261025-0746-fix-cursor-stalls-after-tool-result-resume"
current: "direct"
topics: ["Cursor protocol","stall watchdog","lifecycle reliability"]
---

# Gamemaster checkpoint: 261025-0746-fix-cursor-stalls-after-tool-result-resume/direct

Date: 2026-10-25
Work item: 261025-0746-fix-cursor-stalls-after-tool-result-resume
Status: shipped
In one line: Bounded Cursor tool-result-resume stalls with in-band exec and interaction replies, stream_close markers, a semantic-progress watchdog, and one Pi-retryable stall error.

## Goal

Stop Cursor-provider turns from showing "Working" indefinitely after a Pi tool result is written to the parked Cursor stream. Remove probable root causes by answering unanswered Cursor frames, and bound every remaining stall with one clear retryable error, without affecting legitimate long streamed reasoning.

## How we approached it

The confirmed direct plan (medium assurance) was implemented against HEAD `4cea6cf`.

1. `processServerMessage` was made to classify every frame as progress or non-progress. It also answers interaction queries and handles `ExecServerControlMessage.abort`.
2. `handleExecMessage` replaced fail-closed termination with an `ExecClientThrow` reply for unknown, unsupported, or undecodable execs.
3. A shared reply helper appends `stream_close{id}` after every exec reply: control results, native rejections, throws, resumed `mcpResult`, and non-streaming rejections.
4. `writeSSEStream` gained a semantic-progress timer next to the wire-idle timer. Both now end the turn through one `terminateStall` path.
5. Opt-in metadata-only debug events and timeline rendering were added. The live smoke script gained a `--web-search` mode.
6. README and wiki were updated.

Two medium-assurance reviews passed. Their optional notes were applied: a progress-timer clear on end-stream, plus token, parked-writer, and retry re-arm tests. Both live smoke runs passed after explicit approval. The user then waived the post-rollout session scan, and the item was archived as completed.

## Key decisions

- **Exec drift handling** - chose in-band `ExecClientThrow` plus `stream_close`, matching Cursor's own executor and oh-my-pi. Rejected the previous fail-closed termination, which ended turns that Cursor could have continued.
- **Interaction query policy** - approved hosted web search, web fetch, Exa search, and Exa fetch. Rejected ask-question and switch-mode, and returned an error for create-plan. Left VM setup and unknown queries unanswered because no truthful reply exists.
- **Stall outcome** - one SSE `cursor_stall_timeout` error whose message contains `timeout`, so Pi retries. Rejected proxy-internal replay. Kept the last good checkpoint rather than restoring the pre-turn one.
- **Undecodable mcpArgs (D13)** - defined as argument bytes that are neither a protobuf `Value` nor valid UTF-8. Before this, decoding could never fail, so the planned throw case was unreachable.
- **Timer ownership (D13)** - re-arm the progress watchdog on transparent bridge retry. Run no timers on a writer parked for a Pi tool result.
- **Archival gate (D14)** - the user waived the post-rollout session scan. No stall-rate comparison against the 1.8% baseline will be recorded.

## What did not work

- **Former fail-closed tests** - the 5 tests asserting terminal `cursor_protocol_error` for unknown or unsupported execs conflicted with the new contract. They were intentionally replaced by in-band throw tests, plus a separate unwritable-reply protocol-failure test.
- **Test-only write failure** - making every bridge write throw also broke the cancel action during cleanup. Only the first write must fail (`mockImplementationOnce`) to model an unwritable reply.

## Current state and where we left off

- Shipped/verified: the archived item is `completed` with `plan.md`, `verification.md`, and `outcome.md` under `spec/archive/261025-0746-fix-cursor-stalls-after-tool-result-resume/`. All source, test, README, and wiki changes are uncommitted on top of `4cea6cf`. Nothing is staged.
- Pending: Git checkpoint, CHANGELOG/version bump, and publishing are user-controlled and were not done. The real stall-rate effect is unmeasured.

## Source of truth

- `spec/archive/261025-0746-fix-cursor-stalls-after-tool-result-resume/plan.md`: requirements R1-R6 and decisions D01-D14.
- `spec/archive/261025-0746-fix-cursor-stalls-after-tool-result-resume/verification.md`: commands, review verdicts, live smoke results, residual uncertainty.
- `spec/archive/261025-0746-fix-cursor-stalls-after-tool-result-resume/outcome.md`: delivered scope and deviations.
- `proxy.ts`: frame classification, interaction handler, exec reply helpers, and stall termination.

## Verification

- Done:
  - `npm run check` (typecheck plus 586 tests), focused test files, package smoke, spec validation, and `git diff --check`.
  - Temporary mutations to the progress, abort, wire-idle, and retry re-arm guards were caught by tests.
  - Focused T01-T05 and final contract-quality reviews both passed with no blockers.
  - Approved live smoke on `grok-4.7-fast`: tool replay passed with `stream_close` enabled; web search passed with one hosted web-search query observed and approved.
- Not verified yet:
  - `stream_close` acceptance on other models or in long multi-tool turns.
  - The real-world stall rate after release.
  - Whether the VM-setup query ever occurs locally.

## Open questions, blockers, next safe action

- Open/blocked: none. If stalls recur after release, open a new item using the discovery session-scan method. If live `stream_close` regresses, set `PI_CURSOR_EXEC_STREAM_CLOSE=0`.
- Next safe action: review the working-tree diff and create a user-controlled Git checkpoint.

## Dynamic knowledge trail

- `wiki/architecture.md`: topic-specific dynamic knowledge.
- `wiki/conventions/security-and-state.md`: convention.
- `wiki/conventions/testing.md`: convention.
- `wiki/development.md`: topic-specific dynamic knowledge.
