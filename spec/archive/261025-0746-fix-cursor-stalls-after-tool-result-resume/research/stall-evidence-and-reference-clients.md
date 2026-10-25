# Stall evidence and reference client behavior

Status: complete for discovery round 1
Source date: 2026-10-25

## Question

Where do the reported grok-4.7-fast "working forever" stalls originate, and how do other Cursor agent-protocol clients avoid them?

## Local session evidence (Pi session JSONL, read-only)

Scanned 35 recent Pi sessions containing 1,399 `cursor` assistant messages (1,351 grok-4.7-fast, 48 gpt-5.6-sol). Assistant duration = entry timestamp minus `message.timestamp`.

| Pattern | Count | Interpretation |
| --- | --- | --- |
| `Stream ended without finish_reason`, exactly ~120 s, 0 output, immediately after a tool result | 17 | Wire-idle stall timer fired; `cleanupBridge()` disposed the bridge and `onClose` closed SSE with no error and no retry. Pi auto-retried (error text matches pi-ai `ended without`). |
| `aborted` after 13-15 min, 0 output, immediately after a tool result | 4 | User interrupt. Stall timer never fired, so frames kept arriving without semantic progress. |
| Output arrived after 13-29 min at 1.5-3.7 tok/s | 3 | Same stall that eventually recovered upstream. |
| 3-5 min thinking at 45-60 tok/s, non-repetitive | many | Legitimate model reasoning; not a defect. |

- Stall rate: about 1.8% of 1,312 tool-result resume requests. Preceding tool execution time was ~0 s (median 0.0 s), so long Pi tools are not the trigger. Parallel-tool queue resumes (prior assistant output 0) were not materially different (2.2% vs 1.5%).
- All stalls were in subagent sessions, but 91% of Cursor traffic was subagent traffic; 0 of 124 top-level messages is not statistically meaningful. pi-interactive-subagents does not touch provider streaming.
- No provider debug log existed, so the frame types received during long stalls are unverified.

## Source-level mechanism in this repository (HEAD 4cea6cf)

- Tool continuation keeps the Cursor `Run` stream open; `handleToolResultResume()` writes only an `ExecClientMessage.mcpResult` and then attaches a new `writeSSEStream()`.
- `resetStallTimer()` runs for every parsed Connect frame, including `interactionUpdate.heartbeat`. The processed handoff (`wiki/raw/cursor-mcp-tool-discovery-freeze-handoff.md`) already observed Cursor heartbeats about every 10 s.
- `writeSSEStream()` writes `: ping` to Pi every 15 s regardless of upstream progress, so Pi's own timeouts never fire.
- `processServerMessage()` ignores `interactionQuery` (case 7) and `execServerControlMessage` (case 5, abort).
- `handleExecMessage()` terminates the turn with `CursorProtocolFailure` for decoded-but-unhandled exec cases instead of replying in band.
- No `ExecClientControlMessage` (`stream_close`, `throw`, `heartbeat`) is ever sent.
- Stall kill path: `cleanupBridge()` adds the bridge to `disposedBridges`; the `onClose` handler returns early for disposed bridges, skipping transparent retry and any SSE error.

## Pi retry fact

pi-ai `isRetryableAssistantError()` retries assistant errors whose text matches patterns including `timeout`, `timed out`, `ended without`, `connection lost`, `terminated` (`@earendil-works/pi-ai/dist/utils/retry.js`). The existing no-active-bridge request path then rebuilds from the stored checkpoint; session evidence shows this recovered within seconds after the 120 s errors.

## Reference clients

| Client | Tool continuation model | Exec control | Interaction queries | Progress watchdog |
| --- | --- | --- | --- | --- |
| oh-my-pi `packages/ai/src/providers/cursor.ts` (schema source pinned by this repo; checked at 0b5c27a, 2026-10-22) | Runs tools in-stream through host exec handlers; external-executor mode replies with a handoff text so Cursor ends the turn and the next request carries the result. Never parks a stream across Pi requests. | `ExecClientThrow` followed by `stream_close` for unhandled frames, citing Cursor's own `agent-exec` executor; `stream_close` after streamed shell output. Typed results otherwise sent without `stream_close`. | Answered (`cursor/interaction-query.ts`). | Heartbeats excluded from "real work" tracking. |
| @rahularya01/pi-cursor v1.4.39 (ef3cafb) | Parks the stream across Pi requests (TTL 1 h), resumes with `mcpResult`; checkpoint recovery on failure. | `ExecClientThrow` for unknown execs; no `stream_close`. | Answered (web search approved; others rejected). | Work vs liveness classes. Heartbeats still reset the 3 min idle watchdog unless an exec is unanswered (45 s park deadline). Recovery or retry on timeout. |
| pi-cursor-reins v0.3.2 docs | Translates and parks. | Claims live measurement (2026-09-29, grok-4.7) that every exec reply ends with `stream_close{id}`, plus per-exec `ExecClientHeartbeat{id}` every 3 s while parked; documents specific malformed results that stall forever. | Whitelist approve/reject. | Heartbeats do not reset the 120 s idle timer. |

## Implications

- Most probable defect classes: (1) Cursor waiting on an incomplete exec exchange or an unanswered query while heartbeating, and (2) upstream stalls that the proxy cannot distinguish from progress.
- `stream_close` after `mcpResult` is supported by reins' measurement but not by oh-my-pi's typed-result path; treat it as a hypothesis requiring a live or log-based check.
- A semantic-progress watchdog plus an explicit retryable error bounds every cause, independent of root cause.
- A handoff (one Run per Pi turn) model would remove parked-stream stalls by construction but changes the continuation architecture.

## Sources

- oh-my-pi Cursor provider: <https://github.com/can1357/oh-my-pi/tree/main/packages/ai/src/providers>
- pi-cursor: <https://github.com/Rahularya01/pi-cursor> (`src/stream/server-messages.ts`, `src/stream/tuning.ts`, `src/stream/native-core.ts`), PR #13 <https://github.com/Rahularya01/pi-cursor/pull/13>
- pi-cursor-reins protocol notes: <https://raw.githubusercontent.com/ghoker143/pi-cursor-reins/main/docs/PROTOCOL-AGENT.md>
