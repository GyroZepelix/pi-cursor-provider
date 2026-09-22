# Wiki Log

Curated append-only timeline of durable wiki maintenance events. This is not a codebase changelog, commit log, or session transcript.

Use this shape for new entries:

- Heading: `## [YYYY-MM-DD] <kind> | <short title>`.
- Trigger: why the wiki was updated.
- Inputs: source paths, commit ranges, specs, verification, outcomes, URLs, or raw files used as evidence.
- Wiki pages changed: wiki files changed.
- Verification: checks or source verification.
- Notes: gaps, conflicts, stale areas, or exceptions.

## [2026-09-22] install | repo wiki template

- Trigger: user requested installation from `https://git.dgjalic.com/dgjalic/repo-wiki-template`.
- Inputs: protocol version 2.2.1/schema-2 payload from `/install/template/`.
- Wiki pages changed: `wiki/AGENTS.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`, `wiki/raw/README.md`.
- Verification: required files and managed regions exist; existing files were preserved or merged; protocol validation result was recorded.
- Notes: installed payload may also create or merge root and spec files; initial codebase ingest is still needed.

## [2026-09-22] initial-ingest | seed repository knowledge

- Trigger: initial codebase ingest requested after repo wiki template installation.
- Inputs: tracked working tree at `a89ac0ff34d1d6209f5a40a0b362cce0eea5915c`; the non-empty baseline also included the untracked installed `AGENTS.md`, `spec/`, and `wiki/` payload.
- Wiki pages changed: `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/typescript-and-modules.md`, `wiki/conventions/testing.md`, `wiki/conventions/security-and-state.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/state.md`.
- Verification: navigation, convention routing, relative links, cited paths, ASCII content, fences, whitespace, suspected secrets, checkpoint stability, and outside-wiki status passed; `git diff --check -- wiki` passed.
- Notes: complete at the analysis commit. Type-check is Unverified because project dependencies were absent. Tests, builds, packaging, generators, smoke tests, application commands, and external access were not run.

## [2026-09-22] focused-ingest | Cursor MCP protocol maintenance

- Trigger: the field-36 MCP discovery repair established durable protocol, generation, failure, and testing behavior.
- Inputs: `wiki/raw/cursor-mcp-tool-discovery-freeze-handoff.md`; spec item `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze`; `proto/agent.proto`; `proto/ATTRIBUTION.md`; `proxy.ts`; focused synthetic tests.
- Wiki pages changed: `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/testing.md`, `wiki/conventions/security-and-state.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/state.md`.
- Verification: schema regeneration and focused protocol, proxy, lifecycle, and timeline tests passed during implementation; final whole-repository evidence is recorded separately in the active spec.
- Notes: source and runtime behavior remain pinned to the reviewed schema commit. Live Cursor verification was not authorized and is not represented as deterministic coverage.
