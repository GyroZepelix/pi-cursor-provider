# Security and State Conventions

## Credential and ingress rules

- Keep the Cursor access token inside the extension/proxy boundary. Pi receives a random local proxy bearer, never the upstream credential (`index.ts`, `proxy.ts`, `security.test.ts`).
- Authenticate before reading request content or resolving upstream credentials. Preserve strict loopback Host checks, Origin rejection, media-type checks, body limits, and bounded body timeouts (`proxy.ts`, `security.test.ts`).
- Client-facing failures must not expose exception text, request bodies, credentials, or debug paths (`proxy.ts`, `auth.ts`, `security.test.ts`).

## Session and replay rules

- Derive bridge and conversation keys from the Pi session ID when available. Session switch, fork, tree changes, and shutdown must clear active bridges and conversation state (`index.ts`, `proxy.ts`).
- Preserve the Cursor checkpoint through Pi compaction. It represents upstream conversation state and cannot be replaced reliably by a synthetic local reconstruction (`index.ts`, `README.md`).
- Maintain at most one live bridge per session key. Cleanup sends cancellation, ends the bridge, and retains a bounded force-kill fallback (`proxy.ts`, `PLAN.md`, `security.test.ts`).
- Retry only before text or reasoning output reaches the client. Replay from the pre-turn checkpoint so partial output is never duplicated (`proxy.ts`, `security.test.ts`).
- Treat late callbacks after shutdown or disposal as inert; they must not repopulate state or start retries (`proxy.ts`, `security.test.ts`).

## Debug data

- Debug logging is disabled by default and may contain prompts, responses, or tool data when enabled (`README.md`, `proxy.ts`, `index.ts`).
- Redact credentials and base64 image data. Summarize binary values rather than dumping them (`proxy.ts`, `index.ts`).
- Write only to an owned regular file with mode `0600`; reject symlink and hardlink destinations and never fall back to printing sensitive payloads on write failure (`secure-log.ts`, `security.test.ts`).

Changes to these invariants require focused negative tests in `security.test.ts` in addition to normal behavior coverage.
