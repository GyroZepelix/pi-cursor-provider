# Dream learnings: 260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze

Work item: `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze/direct

Date: 2026-09-22
Dream log: [2026-09-22-2300-gamemaster-checkpoint-260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze-.md](../2026-09-22-2300-gamemaster-checkpoint-260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze-.md)
Outcome: retained learning

### MCP discovery and exec routing

- **Exact written text:**
  > 5. `h2-bridge.mjs` sends Connect/protobuf frames over HTTP/2. `proxy.ts` handles Cursor blob and exec messages and maps text, reasoning, tool calls, usage, and errors back to OpenAI-compatible JSON or SSE (`proxy.ts`, `proto/agent_pb.ts`).
  > 6. Cursor's field-36 MCP state request is answered locally from the same `mcpTools` catalog advertised in request context. Tools are grouped in stable order by non-empty provider identifier, optionally filtered by requested server identifiers, and reported as connected. Only a subsequent `mcpArgs` transfers to Pi's tool continuation path (`proxy.ts`, `proto.test.ts`, `index.test.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Synthetic field-36 and fake-bridge discovery tests proved the local response and continuation boundary, and the full suite preserved existing tool behavior.
- **Expected future benefit:** Future protocol work can identify where MCP discovery is answered and avoid incorrectly surfacing it as a Pi tool call.
- **Why this tier:** This is stable provider architecture specific to Cursor protocol translation, not a repository-wide convention or tentative observation.

### Fail-closed protocol reliability

- **Exact written text:**
  > - Bridge heartbeat, HTTP/2 PING, activity timeout, and stream stall handling bound dead or stuck connections. A separate per-message control-exec watchdog uses the stall-timeout budget but is not reset by Cursor heartbeats; delegated `mcpArgs` execution is excluded (`proxy.ts`, `h2-bridge.mjs`, `bridge.test.ts`, `security.test.ts`).
  > - Exec dispatch is fail-closed: each supported control exec receives its schema-matched response, `mcpArgs` delegates to Pi, and decoded-but-unsupported or unknown cases terminate without transparent retry. Streaming termination is one SSE error plus `[DONE]`; non-streaming termination is one 502 JSON error (`proxy.ts`, `index.test.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Known and unknown exec fixtures in both response modes, fake timers, and no-retry assertions established the terminal and watchdog contracts.
- **Expected future benefit:** Maintainers can preserve the distinction between wire idleness, control progress, and delegated user-tool execution without recreating an indefinite wait.
- **Why this tier:** The guidance is a stable runtime reliability contract for the protocol adapter and belongs with architecture rather than a general convention.

### Reproducible Cursor binding maintenance

- **Exact written text:**
  > `proto/agent.proto` is the complete vendored schema used to generate `proto/agent_pb.ts`; do not hand-edit the generated binding. The schema is pinned to oh-my-pi commit `1b220a4f65554ffb3a505a5df92a2eebf2d60545`, with its MIT notice and exactly three local compatibility declarations recorded in `proto/ATTRIBUTION.md`: `UserMessage.selected_context_blob = 10`, `UserMessage.correlation_id = 17`, and `ConversationStateStructure.client_name = 22`.
  >
  > Install dependencies, ensure `protoc` is on `PATH`, and run `npm run proto:generate`. The repository pins `@bufbuild/protoc-gen-es` to `2.10.2`; generation uses `target=ts,ts_nocheck=true` to remain compatible with the project's `erasableSyntaxOnly` setting. Schema changes require a complete generated-diff review and a second generation compared byte-for-byte with the first (`package.json`, `proto/agent.proto`, `proto/ATTRIBUTION.md`).
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Regeneration was deterministic, the complete prior-field comparison found no shared number or type changes, and package review retained source and attribution.
- **Expected future benefit:** Future schema updates have a repeatable provenance and compatibility procedure instead of risky generated-file edits.
- **Why this tier:** The instructions are stable and action-changing for protobuf maintenance but too specific for an always-loaded pointer or broad repository convention.

### Sanitized protocol timeline usage

- **Exact written text:**
  > - `npm run debug:timeline -- --latest` reads the newest opt-in provider debug log and renders a timeline. It elevates protocol exec receipt, response/delegation, unknown field metadata, watchdog expiry, protocol termination, and stream stalls; it does not enable logging itself (`package.json`, `scripts/debug-log-timeline.mjs`).
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Synthetic text and JSON timeline tests proved the promoted event classes while security coverage excluded retained unknown bytes.
- **Expected future benefit:** Protocol freeze investigations can find the relevant bounded metadata without manually inspecting sensitive full payload events.
- **Why this tier:** This is a stable diagnostic workflow for one maintenance tool, not a universal repository rule or uncertain observation.

### Protocol regression test routing

- **Exact written text:**
  > - Protobuf field/case compatibility, synthetic unknown fields, and MCP state grouping/filtering: `proto.test.ts`.
  > - Proxy requests, message reconstruction, MCP discovery, tools, checkpoints, SSE, terminal protocol errors, and session handling: `index.test.ts`.
  > - Snapshot refresh normalization and sanitized debug-timeline summaries: `scripts.test.ts`.
- **Destination and classification:** `wiki/conventions/testing.md` - `Convention`
- **Session evidence or selection reason:** The repair added distinct schema, fake-proxy, lifecycle, and timeline seams, and all 544 repository tests passed.
- **Expected future benefit:** Future changes can place regressions at the narrowest deterministic seam and avoid live Cursor as routine evidence.
- **Why this tier:** Test placement is a recurring repository convention across protocol maintenance tasks, not session narrative.

### Terminal cleanup and diagnostic safety

- **Exact written text:**
  > - Treat late callbacks after shutdown, disposal, or terminal protocol failure as inert; they must not repopulate state or start retries (`proxy.ts`, `security.test.ts`).
  > - Fail closed on decoded-but-unsupported and unknown exec messages. Protocol failures are terminal and non-retryable, preserve the last good checkpoint, and clean bridge timers, listeners, and maps exactly once (`proxy.ts`, `index.test.ts`, `security.test.ts`).
  > - Redact credentials and base64 image data. Summarize binary values rather than dumping them. Unknown exec diagnostics are restricted to field number, wire type, and byte length; never log retained raw unknown bytes (`proxy.ts`, `index.ts`, `proto.test.ts`).
- **Destination and classification:** `wiki/conventions/security-and-state.md` - `Convention`
- **Session evidence or selection reason:** Independent reviews found and drove fixes for repeated cleanup and in-turn checkpoint retention; late-frame, rollback, map, listener, timer, and secret-absence assertions then passed.
- **Expected future benefit:** Maintainers can prevent protocol failures from corrupting resumable state, retrying ambiguous work, leaking payload data, or reviving disposed bridges.
- **Why this tier:** These are high-impact safety invariants that should guide every future lifecycle or diagnostic change in the provider.
