# Testing Conventions

## Framework and placement

- Tests use Vitest and live beside the root modules as `*.test.ts` (`package.json`).
- Group behavior with `describe` and `test`; parameterize related cases with `test.each`. These patterns recur in `index.test.ts`, `models.test.ts`, `errors.test.ts`, and `security.test.ts`.
- Use synthetic identifiers, prompts, credentials, and protocol messages. Unit and integration tests must not require real Cursor credentials or external traffic (`extension.test.ts`, `errors.test.ts`, `security.test.ts`).

## Test seams

- Use `setBridgeFactoryForTests` and `__testInternals` to control bridge behavior and inspect lifecycle state rather than reaching Cursor (`proxy.ts`, `index.test.ts`, `security.test.ts`).
- Prefer loopback servers for HTTP boundary behavior. `bridge.test.ts` uses local HTTP/2 and TCP servers; proxy suites bind only to loopback.
- Use temporary directories and restore mocks/environment state in cleanup hooks. `scripts.test.ts` and `security.test.ts` demonstrate this pattern.
- Assert cleanup, listener removal, timer disposal, and state-map emptiness for lifecycle changes, not only response payloads (`security.test.ts`, `index.test.ts`).
- Assert client frames written to a fake bridge by decoding them as `AgentClientMessage` (for example the ordered exec reply trace of results, `throw`, and `stream_close`), not by byte snapshots. Byte-level checks are reserved for schema field-number tests in `proto.test.ts` (`index.test.ts`, `security.test.ts`).
- Drive the 120 s wire-idle and 180 s progress windows with fake timers and the `streamHarness` in `security.test.ts`; HTTP-level resume tests use real timers with a small `PI_CURSOR_PROGRESS_TIMEOUT_MS` via `vi.stubEnv` (`index.test.ts`, `errors.test.ts`).

## Coverage expectations by change

- Model parsing, effort maps, context inference, catalog routing: `index.test.ts` and `models.test.ts`.
- Protobuf field/case compatibility, synthetic unknown fields, and MCP state grouping/filtering: `proto.test.ts`.
- Proxy requests, message reconstruction, MCP discovery, tools, checkpoints, SSE, in-band throw replies, `stream_close`, aborts, interaction queries, resume stalls, and session handling: `index.test.ts`.
- Stall watchdog timing, exact-once termination, unwritable-reply protocol failure, and diagnostic redaction: `security.test.ts`.
- Authentication lifecycle and provider registration: `extension.test.ts`.
- Ingress hardening, replay rules, shutdown, bridge failures, and log safety: `security.test.ts`.
- Cursor error decoding and Pi-facing propagation, including stall errors being Pi-retryable: `errors.test.ts`.
- HTTP/2 keepalive transport: `bridge.test.ts`.
- Snapshot refresh normalization, sanitized debug-timeline summaries, and live-smoke opt-in argument handling: `scripts.test.ts`.

Live smoke testing is separate, explicit opt-in, and must use only synthetic prompts (`scripts/smoke-live.mjs`).
