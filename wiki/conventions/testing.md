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

## Coverage expectations by change

- Model parsing, effort maps, context inference, catalog routing: `index.test.ts` and `models.test.ts`.
- Proxy requests, message reconstruction, tools, checkpoints, SSE, and session handling: `index.test.ts`.
- Authentication lifecycle and provider registration: `extension.test.ts`.
- Ingress hardening, replay rules, shutdown, bridge failures, and log safety: `security.test.ts`.
- Cursor error decoding and Pi-facing propagation: `errors.test.ts`.
- HTTP/2 keepalive transport: `bridge.test.ts`.
- Snapshot refresh normalization: `scripts.test.ts`.

Live smoke testing is separate, explicit opt-in, and must use only synthetic prompts (`scripts/smoke-live.mjs`).
