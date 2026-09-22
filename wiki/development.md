# Development

## Prerequisites and setup

- Node.js 22.19 or newer is required (`package.json`).
- Install the locked dependencies with `npm ci` (`package-lock.json`, `README.md`). This command was not run during the initial ingest because package installation was outside scope.
- The package is ESM and source-distributed. There is no build command (`package.json`, `tsconfig.json`).

## Verification commands

| Command | Purpose | Ingest execution |
| --- | --- | --- |
| `npm run typecheck` | Runs `tsc --noEmit` with strict project settings. | Unverified: not run because `node_modules/.bin/tsc` was absent. |
| `npm test` | Runs the Vitest suite once. | Not run: tests were outside the approved ingest checks. |
| `npm run check` | Runs type-check followed by tests. | Not run: includes tests. |
| `HOME="$(mktemp -d)" node scripts/smoke-package.mjs` | Loads the source package with external fetch blocked and verifies registration plus loopback auth. | Not run: application/smoke commands were outside scope. |
| `npm pack` | Creates a package archive after the `prepack` check. | Not run: packaging and its test hook were outside scope. |

`prepack` and `prepublishOnly` both run `npm run check`, so packaging and publishing require the offline type-check and test suite (`package.json`). No lint or formatting-check script is defined. No tracked CI workflow exists at the analysis checkpoint.

## Test organization

Vitest suites are co-located at the repository root. They combine pure helper tests, mocked bridges, loopback HTTP integration, temporary filesystem fixtures, and local HTTP/2/TCP servers (`*.test.ts`). See [Testing conventions](./conventions/testing.md) before changing behavior.

## Maintenance and diagnostics

- `npm run debug:timeline -- --latest` reads the newest opt-in provider debug log and renders a timeline. It elevates protocol exec receipt, response/delegation, unknown field metadata, watchdog expiry, protocol termination, and stream stalls; it does not enable logging itself (`package.json`, `scripts/debug-log-timeline.mjs`).
- `npm run refresh-models` reads `~/.pi/agent/cursor-models-cache.json` and overwrites `cursor-models-raw.json` after strict normalization. Review the diff and catalog tests before committing (`scripts/refresh-models.mjs`, `scripts.test.ts`).
- `npm run test:live -- --live [--tool] <model...>` accesses Cursor, requires existing authentication, and sends synthetic inference requests. It must remain explicit opt-in (`scripts/smoke-live.mjs`).

## Generated code

`proto/agent.proto` is the complete vendored schema used to generate `proto/agent_pb.ts`; do not hand-edit the generated binding. The schema is pinned to oh-my-pi commit `1b220a4f65554ffb3a505a5df92a2eebf2d60545`, with its MIT notice and exactly three local compatibility declarations recorded in `proto/ATTRIBUTION.md`: `UserMessage.selected_context_blob = 10`, `UserMessage.correlation_id = 17`, and `ConversationStateStructure.client_name = 22`.

Install dependencies, ensure `protoc` is on `PATH`, and run `npm run proto:generate`. The repository pins `@bufbuild/protoc-gen-es` to `2.10.2`; generation uses `target=ts,ts_nocheck=true` to remain compatible with the project's `erasableSyntaxOnly` setting. Schema changes require a complete generated-diff review and a second generation compared byte-for-byte with the first (`package.json`, `proto/agent.proto`, `proto/ATTRIBUTION.md`).

## Release and deployment

The deliverable is an npm package, not a deployed service. The documented release path is offline checks, package smoke validation, `npm pack`, and an explicit authenticated `npm publish` (`README.md`, `package.json`). No automated deployment configuration is tracked.

## Initial ingest check result

- Executed: repository discovery, source inspection, status checks, and `node --version` (`v26.8.2`).
- Eligible but skipped: `npm run typecheck`, because project dependencies were not installed and no installer was permitted.
- Not executed: tests, build, packaging, model generation, smoke tests, application commands, or external access.
