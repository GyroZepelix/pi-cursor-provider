# Verification: Fix Cursor MCP tool discovery protocol freeze

Work item: `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze`
Date: 2026-09-22

## Environment

- Direct mode, medium assurance.
- Starting boundary: clean `HEAD` `c6e4a65c7d4962d7ca3d6338f28b3b09ba1385ef`.
- Node.js `v26.8.2`, npm `11.19.1`, `protoc` `35.1`.
- The parent explicitly approved only `@bufbuild/protoc-gen-es` `2.10.2` as a development dependency. No oh-my-pi dependency was added.
- Changed implementation areas: package metadata, vendored schema and generated binding, `proxy.ts`, diagnostic scripts, focused tests, README, and durable wiki pages. No unrelated paths were present.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Pinned schema comparison | Pass | Upstream pinned file differed from `proto/agent.proto` by exactly the three documented compatibility declarations. |
| Prior binding compatibility comparison | Pass | 1,418 prior generated fields compared; zero shared field number/type changes. The sole removed upstream field was unused `ConversationStateStructure.extra_state`. |
| `npm run proto:generate`; copy, regenerate, `cmp` | Pass | Second generated `proto/agent_pb.ts` was byte-for-byte identical. |
| Focused Vitest and type-check | Pass | Final focused run: `proto.test.ts`, `index.test.ts`, `security.test.ts`, and `scripts.test.ts`; 176 tests passed, then `npm run typecheck` passed. |
| `npm run check` | Pass | 8 test files and 544 tests passed with type-check. |
| Isolated package smoke | Pass | Isolated `HOME`; 54 models, authentication enforced, privacy label preserved, and zero external fetches. |
| `npm pack --dry-run` | Pass | Prepack repeated all 544 tests. Package contents include `proto/agent.proto`, `proto/agent_pb.ts`, `proto/ATTRIBUTION.md`, and `scripts/generate-proto.mjs`. |
| `git diff --check -- .` | Pass | No whitespace errors. |
| Markdown fences, local links, and documented paths | Pass | Changed documentation was structurally checked. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --operational` | Pass | Valid item state with no warnings. |
| `git status --short --untracked-files=all` | Pass with expected changes | Only assignment paths were present; nothing was staged or committed. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Reproducible pinned schema, attribution, fields 36 and 55 | `proto/agent.proto`, `proto/ATTRIBUTION.md`, generated binding, deterministic comparison, package listing | Pass |
| Stable local MCP state grouping/filtering, empty success, and `kickOnly` | Pure schema tests and fake-bridge discovery/continuation tests | Pass |
| Only `mcpArgs` delegates to Pi | End-to-end discovery sequence pauses only at the real tool and resumes to completion | Pass |
| Unsupported decoded and unknown execs fail terminally | Known/unknown x streaming/non-streaming matrix verifies one stable error, no retry, SSE `[DONE]` or one 502 | Pass |
| Sanitized unknown diagnostics | Synthetic field 60 verifies only field number, wire type, and byte length; secret bytes are absent from logs and responses | Pass |
| Independent control-exec watchdog | Fake-timer tests verify identity ownership, response clearing, expiry, and delegated `mcpArgs` exclusion; incoming wire activity does not touch this timer | Pass |
| Exact-once cleanup and checkpoint preservation | Central disposed/killed ownership, inert late-frame test, map/listener/timer assertions, and distinct in-turn checkpoint rollback matrix | Pass |
| Diagnostic timeline and maintenance documentation | Text/JSON timeline tests plus README, schema attribution, and wiki updates | Pass |
| Existing behavior remains green | Full 544-test offline suite | Pass |

## Review findings

- Focused segment review initially blocked on non-idempotent cleanup and late-frame re-entry. Central bridge disposal/kill ownership and a late-exec regression were added. Targeted re-review 1: **PASS**.
- Final contract-quality review initially blocked because protocol failure could retain an in-turn checkpoint. Both terminal paths now restore a byte copy of the pre-turn checkpoint, and the four-case terminal matrix proves rollback after a distinct checkpoint. Targeted re-review 1: **PASS**.
- Both review gates finished with no blocking or non-blocking findings.

## Failures and skipped checks

- Initial generation type-check failed because new generated enums conflict with `erasableSyntaxOnly`; the reproducible generator now uses its supported `ts_nocheck=true` option.
- One initial schema test expected the unknown-field payload length rather than Bufbuild's retained encoded-data length; the fixture expectation was corrected without runtime changes.
- One initial operational-validation invocation combined mutually exclusive CLI modes; the documented operational command was rerun successfully.
- The approved install reported two moderate npm audit findings. No audit fix or unrelated dependency change was authorized.
- Live Cursor smoke was skipped because it is optional, model-consuming, and not authorized.

## Unverified areas

- The Cursor protocol is not a supported public API. Offline fixtures verify the pinned schema and failure bounds, but no claim is made about all live Cursor models or future wire revisions.
- No live authenticated Cursor request was made.
