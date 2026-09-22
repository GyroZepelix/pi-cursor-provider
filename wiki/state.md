# Wiki State

Last full ingest commit: a89ac0ff34d1d6209f5a40a0b362cce0eea5915c
Last incremental ingest commit: none
Last lint date: none

## Processed inputs

| Input | Type | Source | Processed date | Output pages | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://git.dgjalic.com/dgjalic/repo-wiki-template` | Protocol 2.2.1/schema-2 template installer | Forgejo repository | 2026-09-22 | `AGENTS.md`, `spec/`, `wiki/` | Installed lean repo wiki template. |
| `a89ac0ff34d1d6209f5a40a0b362cce0eea5915c` | Initial full codebase ingest | Git working tree | 2026-09-22 | `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/typescript-and-modules.md`, `wiki/conventions/testing.md`, `wiki/conventions/security-and-state.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md` | Complete. Baseline included untracked installed root, spec, and wiki files; no tracked files were modified. Type-check Unverified because dependencies were absent. |
| `wiki/raw/cursor-mcp-tool-discovery-freeze-handoff.md`; spec item `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze` | Focused protocol repair ingest | Raw handoff and confirmed spec | 2026-09-22 | `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/testing.md`, `wiki/conventions/security-and-state.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md` | Processed into durable protobuf generation, MCP discovery, fail-closed dispatch, watchdog, diagnostic, and testing guidance; raw payload details were not copied. |

## Full ingest snapshot

- Status: complete
- Analysis commit: `a89ac0ff34d1d6209f5a40a0b362cce0eea5915c`
- Ingest date: 2026-09-22
- Working-tree evidence: baseline `git status --short --untracked-files=all` was non-empty with the installed untracked `AGENTS.md`, `spec/**`, and `wiki/**`; tracked source had no modifications.
- Output pages: `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/typescript-and-modules.md`, `wiki/conventions/testing.md`, `wiki/conventions/security-and-state.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/state.md`.
- Allowed checks: `npm run typecheck` was eligible but not run because `node_modules/.bin/tsc` was absent. No installer or fallback compiler was invoked.
- Unresolved gaps at the original checkpoint: protobuf regeneration inputs and type-check were unverified. Both were superseded on 2026-09-22 by the tracked schema/generation workflow and focused offline verification for the Cursor MCP repair; the original ingest facts remain unchanged.

## Maintenance policy

This file is compact processing state for resume, dedupe, lint, and ingest checkpoints. It is not append-only history.

Update this file when:

- Full or incremental ingest checkpoints change.
- Lint date or lint checkpoint state changes.
- Raw files, source batches, URL batches, specs, verification, outcomes, or commit ranges are processed into durable wiki knowledge and need dedupe/resume tracking.

Do not add rows for every session, chat turn, verification command, routine implementation plan, routine wiki edit, log-only event, or codebase change that does not affect durable wiki knowledge.

For wiki maintenance rows, `Output pages` should name wiki pages. Install/bootstrap rows may summarize the broader installed payload.

- Update checkpoints only after affected wiki pages are processed.
- Keep raw sources separate from trusted wiki synthesis.
- Mark uncertain or unverified pages as stale in `wiki/index.md`.
