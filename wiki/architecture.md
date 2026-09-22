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
5. `h2-bridge.mjs` sends Connect/protobuf frames over HTTP/2. `proxy.ts` handles Cursor blob and tool messages and maps text, reasoning, tool calls, usage, and errors back to OpenAI-compatible JSON or SSE (`proxy.ts`, `proto/agent_pb.ts`).

## State and ownership

- `conversationStates` owns the current checkpoint, blob store, effective context window, token usage, and system prompt per derived conversation key (`proxy.ts`).
- `sessionBridges` tracks every live bridge; `activeBridges` is the subset paused for tool results. At most one live bridge is retained per session key (`proxy.ts`, `PLAN.md`).
- Tool continuations reuse the live bridge. Session switch, fork, tree changes, and shutdown clean state; local Pi compaction intentionally preserves the Cursor checkpoint (`index.ts`, `proxy.ts`).
- Runtime state is in-memory only. Model discovery also writes a best-effort normalized cache at `~/.pi/agent/cursor-models-cache.json` (`proxy.ts`).

## Reliability and security invariants

- The proxy binds only to loopback, uses a random 256-bit bearer, and does not expose upstream credentials as local credentials (`proxy.ts`, `security.test.ts`).
- Retries occur only before content has reached the client, preventing replayed partial output. The pre-turn checkpoint is retained for a clean retry (`proxy.ts`, `security.test.ts`).
- Bridge heartbeat, HTTP/2 PING, activity timeout, and stream stall handling bound dead or stuck connections (`proxy.ts`, `h2-bridge.mjs`, `bridge.test.ts`).
- Checkpoints and blobs are retained across transient failures and client disconnects when available, but shutdown rejects late callbacks (`proxy.ts`, `security.test.ts`).
- Debug logging is opt-in. Binary data and credentials are summarized or redacted, and file writes require a private owned regular file (`proxy.ts`, `index.ts`, `secure-log.ts`).

## Model and usage policy

Live discovery takes precedence over the on-disk cache and bundled snapshot. Effort variants are grouped for Pi's thinking controls, but transport routing preserves exact advertised IDs (`index.ts`, `model-ids.ts`). Context windows, output limits, and prices are adapter estimates where Cursor discovery lacks those fields. Runtime token scaling compensates when Cursor reports a tighter effective context window (`index.ts`, `proxy.ts`, `README.md`).

## Tradeoffs and limits

- The OpenAI-compatible loopback layer lets Pi reuse an existing provider transport, but adds HTTP validation and translation state (`index.ts`, `proxy.ts`).
- The Node bridge isolates HTTP/2 behavior and supports Pi runtimes that may not provide a usable native HTTP/2 path, at the cost of one child process per active request (`h2-bridge.mjs`, `proxy.ts`).
- Checkpoints improve continuity and tool replay but are lost on process restart; reconstruction from local Pi messages is the fallback (`proxy.ts`, `README.md`).
- Non-streaming requests reject Cursor tool execution instead of pausing for a continuation (`proxy.ts`).
