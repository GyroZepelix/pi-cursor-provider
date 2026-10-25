# Architecture

## System boundaries

Pi loads `index.ts` as a source extension. The extension owns provider registration and a loopback HTTP server, while Cursor owns authentication, model discovery, and inference. A separate Node child process in `h2-bridge.mjs` owns the HTTP/2 connection to `api2.cursor.sh` (`package.json`, `index.ts`, `auth.ts`, `proxy.ts`).

## Startup and authentication flow

1. `index.ts` starts the proxy on an ephemeral `127.0.0.1` port and registers session hooks.
2. It registers cached models when available, otherwise `FALLBACK_MODELS`, then refreshes registration after authenticated live discovery.
3. Pi's OAuth callbacks use `auth.ts` for PKCE login or token refresh. The upstream access token remains in the extension closure.
4. `getApiKey` gives Pi the proxy's random per-instance bearer token, not the Cursor credential (`index.ts`, `proxy.ts`).

## Request flow

1. The `before_provider_request` hook adds the Pi session ID to Cursor-provider payloads (`index.ts`).
2. `proxy.ts` authenticates the request before reading its body or resolving the Cursor credential. It rejects browser origins, unexpected hosts, unsupported encoding/media types, malformed shapes, timeouts, and bodies over 32 MiB.
3. OpenAI messages, images, tools, and effort settings are normalized. `model-ids.ts` resolves the selected canonical model to an exact discovered Cursor ID.
4. `buildCursorRequest` serializes protobuf messages and content-addressed blobs. If no server checkpoint exists it reconstructs recent turns; older turns can be folded into an inline summary archive.
5. `h2-bridge.mjs` sends Connect/protobuf frames over HTTP/2. `proxy.ts` handles Cursor blob and exec messages and maps text, reasoning, tool calls, usage, and errors back to OpenAI-compatible JSON or SSE (`proxy.ts`, `proto/agent_pb.ts`).
6. Cursor's field-36 MCP state request is answered locally from the same `mcpTools` catalog advertised in request context. Tools are grouped in stable order by non-empty provider identifier, optionally filtered by requested server identifiers, and reported as connected. Only a subsequent `mcpArgs` transfers to Pi's tool continuation path (`proxy.ts`, `proto.test.ts`, `index.test.ts`).

## State and ownership

- `conversationStates` owns the current checkpoint, blob store, effective context window, token usage, and system prompt per derived conversation key (`proxy.ts`).
- `sessionBridges` tracks every live bridge; `activeBridges` is the subset paused for tool results. At most one live bridge is retained per session key (`proxy.ts`, `PLAN.md`).
- Tool continuations reuse the live bridge. Session switch, fork, tree changes, and shutdown clean state; local Pi compaction intentionally preserves the Cursor checkpoint (`index.ts`, `proxy.ts`).
- Runtime state is in-memory only. Model discovery also writes a best-effort normalized cache at `~/.pi/agent/cursor-models-cache.json` (`proxy.ts`).

## Reliability and security invariants

- The proxy binds only to loopback, uses a random 256-bit bearer, and does not expose upstream credentials as local credentials (`proxy.ts`, `security.test.ts`).
- Retries occur only before content has reached the client, preventing replayed partial output. The pre-turn checkpoint is retained for a clean retry (`proxy.ts`, `security.test.ts`).
- Bridge heartbeat, HTTP/2 PING, activity timeout, and stream stall handling bound dead or stuck connections. A separate per-message control-exec watchdog uses the stall-timeout budget but is not reset by Cursor heartbeats; delegated `mcpArgs` execution is excluded, and in-band throw replies or Cursor aborts clear it (`proxy.ts`, `h2-bridge.mjs`, `bridge.test.ts`, `security.test.ts`).
- Streaming turns (fresh and tool-result resumes) have two bounds: the wire-idle stall timer (`PI_CURSOR_BRIDGE_STALL_TIMEOUT_MS`, 120 s, reset by any frame including heartbeats) and a semantic-progress watchdog (`PI_CURSOR_PROGRESS_TIMEOUT_MS`, 180 s, `0` disables) reset only by progress frames: non-empty text or reasoning, token deltas, tool-call, step, summary, and turn-ended updates, checkpoints, KV exchanges, answered or delegated execs, aborts, and answered interaction queries. `processServerMessage` returns this classification. Either expiry emits exactly one `cursor_stall_timeout` SSE error whose message contains `timeout` (Pi-retryable), then `[DONE]`, and cleans the bridge once; there is no proxy-internal replay and the last good checkpoint is kept. The parked writer between a tool-call pause and Pi's resume runs no timers (`proxy.ts`, `security.test.ts`, `index.test.ts`, `errors.test.ts`).
- Exec dispatch answers in band: each supported control exec receives its schema-matched response, native Cursor tools are rejected, `mcpArgs` delegates to Pi, and any exec that cannot be answered or delegated (decoded-but-unsupported, unknown oneof, or `mcpArgs` arguments that are neither a protobuf `Value` nor UTF-8) receives `ExecClientThrow` with a short sanitized error while the turn continues. Every exec reply, including delegated results written on resume and non-streaming rejections, is followed by `ExecClientControlMessage.stream_close` for the same id unless `PI_CURSOR_EXEC_STREAM_CLOSE=0|false`. Only an unwritable reply frame still terminates (`cursor_protocol_error`, pre-turn checkpoint restored) (`proxy.ts`, `index.test.ts`).
- `ExecServerControlMessage.abort{id}` clears control-watchdog entries for that id; a matching delegated `mcpArgs` awaiting Pi is marked aborted and its result is not written on resume (`proxy.ts`, `index.test.ts`).
- Interaction queries: web search, web fetch, Exa search, and Exa fetch are approved; ask-question and switch-mode are rejected and create-plan returns an error; VM setup and unknown cases get no reply and are bounded by the progress watchdog. The shared handling applies to streaming and non-streaming paths (`proxy.ts`, `index.test.ts`).
- Checkpoints and blobs are retained across transient failures and client disconnects when available, but shutdown rejects late callbacks (`proxy.ts`, `security.test.ts`).
- Debug logging is opt-in. Binary data and credentials are summarized or redacted, and file writes require a private owned regular file (`proxy.ts`, `index.ts`, `secure-log.ts`).

## Model and usage policy

Live discovery takes precedence over the on-disk cache and bundled snapshot. Effort variants are grouped for Pi's thinking controls, but transport routing preserves exact advertised IDs (`index.ts`, `model-ids.ts`). Context windows, output limits, and prices are adapter estimates where Cursor discovery lacks those fields. Runtime token scaling compensates when Cursor reports a tighter effective context window (`index.ts`, `proxy.ts`, `README.md`).

## Tradeoffs and limits

- The OpenAI-compatible loopback layer lets Pi reuse an existing provider transport, but adds HTTP validation and translation state (`index.ts`, `proxy.ts`).
- The Node bridge isolates HTTP/2 behavior and supports Pi runtimes that may not provide a usable native HTTP/2 path, at the cost of one child process per active request (`h2-bridge.mjs`, `proxy.ts`).
- Checkpoints improve continuity and tool replay but are lost on process restart; reconstruction from local Pi messages is the fallback (`proxy.ts`, `README.md`).
- Non-streaming requests reject Cursor tool execution instead of pausing for a continuation (`proxy.ts`).
