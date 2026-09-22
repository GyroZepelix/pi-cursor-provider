# Repository Map

## Entry points and public surface

- `index.ts`: Pi extension entry point from `package.json`. Registers provider `cursor`, OAuth callbacks, model definitions, request/session hooks, and proxy lifecycle.
- `proxy.ts`: local authenticated HTTP API. Its runtime routes are `GET /v1/models` and `POST /v1/chat/completions`; it also exports helpers used by tests and model registration.
- `h2-bridge.mjs`: child-process transport that converts length-prefixed stdin/stdout messages into one Cursor HTTP/2 stream.
- `auth.ts`: PKCE login polling, refresh, and token-expiry handling.

## Core modules

- `model-ids.ts`: parses model IDs, groups effort variants, builds Pi thinking-level maps, and resolves picker IDs to exact Cursor-advertised IDs.
- `cursor-models-raw.json`: normalized bundled fallback model catalog used before live discovery or a usable local cache.
- `cursor-errors.ts`: decodes Cursor's structured display details and preserves upstream fallback wording and retryability.
- `secure-log.ts`: appends debug data only to private, owned, regular files without following a final symlink.
- `proto/agent_pb.ts`: generated protobuf descriptors and message/service schemas consumed by `proxy.ts`; do not hand-edit generated declarations.

## Tests

- `index.test.ts`: broad model parsing, request construction, session state, tool continuation, proxy integration, and process-exit coverage.
- `security.test.ts`: ingress validation, lifecycle cleanup, replay safety, bridge failures, and private debug logging.
- `models.test.ts`, `errors.test.ts`, `extension.test.ts`: catalog/routing, native error propagation, pricing, and extension authentication lifecycle.
- `bridge.test.ts`: local HTTP/2 bridge keepalive behavior.
- `scripts.test.ts`: safe model-snapshot normalization and refusal behavior.

## Scripts

- `scripts/refresh-models.mjs`: validates the user's discovered model cache and overwrites `cursor-models-raw.json` with normalized fields.
- `scripts/debug-log-timeline.mjs`: reads provider JSONL logs and renders a diagnostic timeline.
- `scripts/smoke-package.mjs`: offline package registration and loopback authentication smoke check.
- `scripts/smoke-live.mjs`: explicitly opt-in live Cursor inference and tool-replay smoke check.

## Common change locations

- Provider registration, pricing, model presentation, or Pi hooks: `index.ts` and usually `extension.test.ts` or `models.test.ts`.
- Model suffix parsing and exact effort routing: `model-ids.ts`, `index.test.ts`, and `models.test.ts`.
- HTTP validation, request translation, conversation state, tools, streaming, or retries: `proxy.ts`, primarily with `index.test.ts` and `security.test.ts`.
- Upstream transport timeouts or PING behavior: `h2-bridge.mjs` and `bridge.test.ts`.
- Cursor error wording: `cursor-errors.ts` and `errors.test.ts`.
- Catalog refresh: `cursor-models-raw.json`, `scripts/refresh-models.mjs`, `scripts.test.ts`, and catalog assertions in `models.test.ts`.
