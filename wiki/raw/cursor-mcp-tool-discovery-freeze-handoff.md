# Handoff: Cursor MCP tool discovery freezes tool-enabled Pi agents

Date: 2026-09-22
Status: Investigation complete, implementation not started
Target repository snapshot: `a89ac0ff34d1d6209f5a40a0b362cce0eea5915c`
Target package: `@offbynan/pi-cursor-provider` 0.7.0

## Purpose

This document preserves the evidence, diagnosis, repair boundaries, and verification plan for a Cursor provider failure that leaves tool-enabled Pi agents and Pi subagents running forever after their initial reasoning output.

It is a curated handoff, not a raw session transcript. No credentials, authentication material, private prompts, full debug logs, or private session paths are included.

## Executive summary

The provider's bundled Cursor protobuf schema is stale. During dynamic MCP tool discovery, Cursor sends `ExecServerMessage` field 36. The bundled `proto/agent_pb.ts` does not define that field, so Bufbuild preserves it as unknown data while decoding `execMsg.message.case` as `undefined`.

`handleExecMessage()` logs:

```text
[cursor-provider] UNHANDLED exec case: "undefined". Bridge may stall.
```

It then sends no response because it cannot derive a result case from `undefined`. Cursor waits for the missing exec response and keeps the stream alive with heartbeat frames. Pi consequently receives no terminal provider event, so it cannot emit `message_end`, `agent_end`, or `agent_settled`. A subagent supervisor cannot finalize a child whose provider request never finishes.

A newer independently published Cursor wire schema maps field 36 to `McpStateExecArgs` and the matching client field 36 to `McpStateExecResult`. This matches the live trace: after a native tool rejection, the model attempted `GetDynamicTools` for the Pi MCP namespace and immediately produced the unknown field-36 exec message.

The problem reproduces without any subagent extension loaded. The fix belongs in this provider.

## User-visible pattern

Observed in Cursor-backed subagent profiles:

1. The child accepts its task.
2. It emits one or more thinking blocks.
3. It tries to inspect files or otherwise use a tool.
4. The pane prints the unhandled exec warning in some runs.
5. The child remains in `Working` indefinitely.
6. The parent receives neither a successful result nor a provider failure.

The reported profiles used Cursor models, including `cursor/gemini-3.8-flash`. The same symptom was seen across multiple tool-capable subagents. Only `gemini-3.8-flash:medium` was isolated in the bounded standalone reproduction, so model-wide impact beyond that path should be described as observed but not exhaustively proven.

## Verified environment

- Provider: `@offbynan/pi-cursor-provider` 0.7.0
- Pi: 0.87.0
- Node.js: 26.8.2
- Reproduced model: `cursor/gemini-3.8-flash:medium`
- Platform: macOS
- Target source commit: `a89ac0ff34d1d6209f5a40a0b362cce0eea5915c`

The installed package used by the live run and this checkout were compared after reproduction:

- `proxy.ts` SHA-256 in both locations: `91e0bc24fbec662b3cd48a45fcccd8b570902e0c8c0f456c570317ddb8edf83b`
- `proto/agent_pb.ts` SHA-256 in both locations: `1586e66f2f59bd6bc666ca8f48ed9c358063c321d8e11ed8a058e4725458db8d`

This establishes that the reproduced behavior applies to the target checkout, not merely to a different installed build.

## Minimal reproduction

The reproduction intentionally loads only the Cursor provider. It does not load the interactive-subagents extension.

```bash
PI_CURSOR_PROVIDER_DEBUG=1 \
pi -p \
  --no-session \
  --no-extensions \
  -e /path/to/pi-cursor-provider/index.ts \
  --no-skills \
  --no-prompt-templates \
  --no-context-files \
  --tools read \
  --model cursor/gemini-3.8-flash:medium \
  "Use the read tool once to read package.json, then reply with only the package name."
```

Verified result:

- Initial reasoning streamed normally.
- The provider printed `UNHANDLED exec case: "undefined"`.
- The process did not complete within a bounded 45-second run.
- It was terminated by the diagnostic harness after the timeout.

### Control run

```bash
PI_CURSOR_PROVIDER_DEBUG=1 \
pi -p \
  --no-session \
  --no-extensions \
  -e /path/to/pi-cursor-provider/index.ts \
  --no-skills \
  --no-prompt-templates \
  --no-context-files \
  --no-tools \
  --model cursor/gemini-3.8-flash:medium \
  "Reply with exactly OK. Do not use any tools."
```

Verified result:

- Completed normally in approximately 4.1 seconds.
- Exit code was zero.
- Output was `OK`.
- No unhandled exec warning occurred.

This separates the failing tool-discovery path from ordinary Cursor text streaming.

## Sanitized protocol timeline

The opt-in provider debug log established this sequence:

1. Pi sent one declared tool, `read`, in the OpenAI-compatible request.
2. Cursor streamed several thinking deltas.
3. The model selected Cursor's native `Read` tool.
4. The provider rejected the native tool as designed with the instruction to use MCP tools instead.
5. Cursor recorded the native tool failure and continued the same turn.
6. The model selected `GetDynamicTools` for namespace `pi` and tool name `read`.
7. Cursor sent an `execServerMessage` whose decoded value contained:

   ```json
   {
     "id": 2,
     "execId": "",
     "message": {},
     "$unknown": [
       {
         "no": 36,
         "wireType": 2,
         "byteLength": 5
       },
       {
         "no": 55,
         "wireType": 0,
         "byteLength": 1
       }
     ]
   }
   ```

8. The provider logged the undefined exec case and sent no response.
9. Cursor continued sending interaction heartbeat messages at roughly ten-second intervals.
10. No turn-ended or end-stream event arrived before the diagnostic harness terminated the run.

Only field numbers, wire types, lengths, event classes, and non-sensitive control metadata are retained here. The original debug log contained prompts and should not be committed or shared unsanitized.

## Source-level root cause

### 1. The bundled `ExecServerMessage` schema stops before current fields

`proto/agent_pb.ts` defines the `ExecServerMessage.message` oneof through known cases including `writeShellStdinArgs` at field 23, followed by the generated undefined alternative. It does not define field 36.

Relevant location:

- `proto/agent_pb.ts`, `ExecServerMessage` near line 6880

A newer external Cursor schema identifies additional cases, including:

- field 29: `RedactedReadArgs`
- field 36: `McpStateExecArgs`
- field 27: `ExecuteHookArgs`
- field 28: `SubagentArgs`
- later Pi-specific and control cases
- field 55: `accept_hook_additional_contexts`

The reproduced field 36 is therefore not an arbitrary malformed packet. It is a valid newer Cursor protocol message missing from the provider's generated bindings.

### 2. Undefined exec cases cannot receive a response

`proxy.ts` routes `execServerMessage` into `handleExecMessage()`:

- `processServerMessage()` near line 1967
- `handleExecMessage()` near line 2058

The handler reads:

```ts
const execCase = (execMsg as any).message.case;
```

Its catch-all logs the warning and attempts to derive a result name by replacing an `Args` suffix:

```ts
const guessedResult = (execCase as string)?.replace(/Args$/, "Result");
```

When `execCase` is `undefined`, `guessedResult` is also undefined. No `ExecClientMessage` is written and no error is propagated to the SSE layer. Cursor remains blocked waiting for the field-36 response.

### 3. Heartbeats prevent the existing stall timeout

`writeSSEStream()` installs a stall timer with a default of 120 seconds. The timer is reset for every parsed Connect frame:

- `proxy.ts` near lines 2873-2916

The run received Cursor interaction heartbeat frames approximately every ten seconds. Those frames reset the timer even though the unanswered exec request makes no semantic progress. The documented stall detector therefore cannot terminate this deadlock.

This is secondary to the missing schema and response handling, but it explains the indefinite rather than bounded failure.

### 4. Pi and the subagent supervisor are downstream victims

The provider never closes the SSE response or sends `[DONE]` or an SSE error. Pi remains inside the active provider request. Consequently, higher-level Pi lifecycle events never occur. Waiting for `agent_settled`, changing subagent finalization logic, or changing tmux polling cannot repair this provider-level deadlock.

## Current protocol gap

The repository tracks only generated `proto/agent_pb.ts`. It does not track the source `agent.proto` or a regeneration command. The existing wiki already marks protobuf regeneration as unverified.

Do not treat direct hand edits to `proto/agent_pb.ts` as the final repair. The file identifies itself as generated. A durable solution should establish a reviewed schema source and reproducible generation procedure, or document a deliberately different binding-maintenance strategy.

External schema evidence used during diagnosis:

- `https://docs.rs/omp-llm-cursor/latest/omp_llm_cursor/wire/struct.ExecServerMessage.html`
- `https://docs.rs/omp-llm-cursor/latest/omp_llm_cursor/wire/exec_server_message/enum.Message.html`
- `https://docs.rs/omp-llm-cursor/latest/src/omp_llm_cursor/wire.rs.html`

That schema states it is pinned from `packages/ai/src/providers/cursor/proto/agent.proto`. It is useful corroborating evidence, not automatically authoritative for this package. Confirm the intended Cursor schema provenance before regeneration.

## What needs to be fixed

### Required fix A: refresh the Cursor protobuf bindings

Acquire and review a current Cursor `agent.proto`, then regenerate the TypeScript bindings with the repository's compatible `protoc-gen-es` toolchain.

At minimum, the resulting schema must decode:

- `McpStateExecArgs` at `ExecServerMessage` field 36
- `McpStateExecResult` at `ExecClientMessage` field 36
- their nested state, server, success, error, and rejected messages
- field 55 metadata where applicable

Because the current schema is substantially behind, review the complete generated diff rather than copying only field 36. Adding every new message to runtime behavior is not automatically required, but all current wire cases should decode safely and unsupported cases must fail explicitly.

### Required fix B: answer MCP state discovery

Add a `mcpStateExecArgs` branch in `handleExecMessage()`.

The response must accurately represent the MCP tools exposed through the existing `mcpTools` argument. Current tool definitions use `providerIdentifier: "pi"`. The implementation likely needs to group tools by provider/server identifier and return a corresponding `McpStateExecResult` success containing one or more MCP server records.

Before implementation, verify exact semantics for:

- `serverIdentifiers`
- `kickOnly`
- `serverName` versus `serverIdentifier`
- status values
- instructions and plugin/marketplace metadata
- behavior when a requested server is absent

Do not guess these values solely from message names. Inspect a current compatible implementation or protocol source and add fixture-backed tests.

This control request is provider protocol plumbing. It should be answered inside the provider, not surfaced to Pi as a normal user tool call.

### Required fix C: fail closed on unsupported exec messages

A future protocol addition must not recreate an infinite pending request.

When an exec message has no recognized case, the provider should:

1. record sanitized diagnostics, including retained unknown field numbers when available through a supported Bufbuild API;
2. stop or cancel the affected bridge;
3. produce a terminal OpenAI-compatible SSE error for streaming requests, or an appropriate HTTP error for non-streaming requests;
4. close the response and clean up timers, bridge maps, and listeners exactly once.

Simply throwing from `handleExecMessage()` is insufficient with the current structure because the surrounding per-message catch logs processing errors and continues. Route protocol failures into the existing terminal stream error and cleanup machinery.

Avoid depending directly on undocumented `$unknown` object layout if `@bufbuild/protobuf` exposes a supported unknown-field API.

### Required fix D: preserve meaningful stall protection

The immediate unknown-message path should fail synchronously, so it must not rely on the 120-second stall timer.

Also decide whether to harden no-progress detection. Options include:

- do not reset a semantic-progress timer for interaction heartbeat messages;
- track an unanswered exec request with its own bounded deadline;
- retain the existing wire-idle timer for connection silence while adding a separate protocol-progress watchdog.

Do not blindly classify all heartbeat-only periods as failure. Some legitimate generations may be long. Prefer a narrowly scoped unanswered-exec deadline or explicit unsupported-message termination.

### Required fix E: improve diagnostic timeline visibility

`scripts/debug-log-timeline.mjs` does not currently elevate `server_message` unknown exec cases or `stream.stall_timeout` into its concise notable timeline.

Add sanitized events for protocol drift, for example:

- decoded exec case
- unknown field numbers only
- whether an exec response was sent
- protocol-failure termination

Never include credentials, complete prompts, tool arguments, or raw binary payloads in default diagnostics.

## Suggested implementation order

1. Preserve a synthetic field-36 binary fixture derived from a schema-generated test message, not from a private live log.
2. Establish the schema source and reproducible generation command.
3. Regenerate `proto/agent_pb.ts` and review all wire changes.
4. Add isolated encode/decode coverage proving field 36 becomes `mcpStateExecArgs`.
5. Implement `mcpStateExecArgs` response semantics using existing `mcpTools`.
6. Add a deterministic stream-level regression proving discovery proceeds to the existing `mcpArgs` tool-call path.
7. Add an unsupported-exec fail-fast regression.
8. Add the narrowly scoped progress-watchdog regression if that hardening is included.
9. Update diagnostic timeline handling and user documentation.
10. Run offline verification, then an explicitly approved synthetic live smoke test.

## Test seams and proposed regressions

Use existing test conventions and bridge seams rather than live Cursor for deterministic coverage:

- `setBridgeFactoryForTests()` controls bridge behavior.
- `__testInternals` exposes state needed by proxy and lifecycle tests.
- `writeSSEStreamForTests()` already drives synthetic streaming cases.
- `index.test.ts` already covers `mcpArgs`, pending execs, tool result resume, checkpoints, and stream behavior.
- `security.test.ts` already covers bridge cleanup, shutdown, and late tool callbacks.

Recommended tests:

### Schema decoding

- Encode an `ExecServerMessage` with `mcpStateExecArgs` using the refreshed schema.
- Decode it through `AgentServerMessageSchema`.
- Assert `message.case === "mcpStateExecArgs"` and exact argument fields.

### MCP state response

- Supply multiple synthetic `McpToolDefinition` entries with one or more provider identifiers.
- Emit `mcpStateExecArgs` from a fake bridge.
- Decode the written `AgentClientMessage`.
- Assert matching ID, exec ID, result case, server identifiers, and tool definitions.
- Cover absent requested servers and `kickOnly` according to confirmed protocol semantics.

### End-to-end synthetic discovery

- Drive request-context discovery, MCP state discovery, and a subsequent `mcpArgs` tool call through the fake bridge.
- Assert the provider pauses at the actual Pi tool call rather than at the MCP state control request.
- Resume with a synthetic tool result and assert clean completion.

### Unknown exec fail-fast

- Feed a protobuf message with an unknown oneof field.
- Assert one terminal error is sent.
- Assert the bridge is cancelled or closed.
- Assert response, timers, listeners, and bridge maps are cleaned once.
- Assert the request does not remain pending.

### Heartbeat behavior

- While an exec response is pending or protocol state is invalid, emit heartbeat frames under fake timers.
- Assert heartbeats do not keep the invalid request alive forever.
- Preserve legitimate heartbeat behavior outside the narrowly defined failure state.

### Existing behavior

Retain coverage for:

- native Cursor tool rejection;
- ordinary `mcpArgs` routing;
- tool-result continuation;
- no-tool streaming completion;
- retry-before-content rules;
- checkpoint preservation;
- client interruption and shutdown cleanup;
- debug-log redaction.

## Acceptance criteria

The repair is complete when all of the following are verified:

- A tool-enabled standalone Pi request no longer logs `UNHANDLED exec case: "undefined"` for MCP state discovery.
- Dynamic discovery can find the declared Pi `read` tool and invoke it.
- The minimal reproduction exits normally with the expected package name.
- A Cursor-backed Pi subagent can inspect files, return a final response, and reach normal Pi settlement.
- An unsupported future exec field returns a clear bounded provider error instead of hanging.
- Cursor heartbeat frames cannot mask an invalid unanswered exec forever.
- Existing no-tool, direct MCP tool call, continuation, retry, checkpoint, and cleanup tests remain green.
- Debug output remains opt-in, private, and sanitized.
- The schema provenance and regeneration command are documented and reproducible.

## Verification commands

Dependencies were not installed in the target checkout at handoff creation. After an explicitly approved install:

```bash
npm ci
npm run typecheck
npm test
HOME="$(mktemp -d)" node scripts/smoke-package.mjs
npm pack --dry-run
```

Use the smallest relevant Vitest pattern during iteration before the complete suite.

Live verification is model-consuming and requires existing Cursor authentication. Keep it explicit and synthetic:

```bash
npm run test:live -- --live --tool gemini-3.8-flash
```

Confirm the exact live-smoke model argument expected by the refreshed catalog before running. Do not represent live provider behavior as deterministic regression coverage.

## Workaround until repaired

- Use non-Cursor models for tool-capable Pi agent profiles.
- Tool-free Cursor prompts can still complete, but this is not a practical substitute for coding agents.
- Existing frozen processes must be interrupted or terminated explicitly; updating code cannot retroactively unblock an already unanswered exec request.

## GitHub reporting status

As checked on 2026-09-22:

- `offbynan/pi-cursor-provider` has GitHub Issues disabled (`has_issues: false`).
- Its issue API contained pull requests but no issue matching this failure.
- The upstream `ndraiman/pi-cursor-provider` issue tracker had no report matching `McpStateExecArgs`, field 36, `UNHANDLED exec case`, or the dynamic tool-discovery freeze.
- A pull request description is therefore the practical public report path for the fork.

Repository and tracker references:

- `https://github.com/offbynan/pi-cursor-provider`
- `https://api.github.com/repos/offbynan/pi-cursor-provider`
- `https://github.com/ndraiman/pi-cursor-provider/issues`

## Boundaries and non-goals

- Do not change Pi's subagent lifecycle to compensate for an unfinished provider stream.
- Do not add automatic replay of ambiguous tool calls.
- Do not expose raw prompts, tool arguments, checkpoint blobs, or credentials in diagnostics.
- Do not hand-maintain a large generated protobuf file without a documented source and process.
- Do not claim every Cursor model is affected until model coverage is measured.
- Do not treat a shorter generic timeout as the primary fix. The provider must answer or reject protocol requests correctly.

## Remaining uncertainty

- The exact authoritative source and license/provenance path for the current Cursor `agent.proto` still needs confirmation.
- Exact `McpStateExecResult` semantics need verification against a current compatible implementation or protocol source.
- Only `gemini-3.8-flash:medium` was isolated in the standalone reproduction, although multiple Cursor-backed profiles showed the same user-visible stall.
- The best secondary progress watchdog design remains a decision for implementation. The required immediate behavior is explicit response or explicit failure for every exec request.

## Primary local source references

- `proxy.ts`: provider bridge, server-message dispatch, exec handling, SSE lifecycle, and stall timer
- `proto/agent_pb.ts`: generated stale Cursor schema
- `index.test.ts`: proxy, MCP, tool continuation, stream, and checkpoint tests
- `security.test.ts`: lifecycle, shutdown, cleanup, and logging tests
- `bridge.test.ts`: HTTP/2 bridge behavior
- `scripts/debug-log-timeline.mjs`: diagnostic summarizer
- `README.md`: documented provider behavior and live smoke workflow
- `package.json`: versions and verification commands
