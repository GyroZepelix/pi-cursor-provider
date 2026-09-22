# Wiki Index

Durable current-state codebase knowledge. Read this file first when answering codebase questions.

## Start here

- [Wiki instructions](./AGENTS.md): Scoped rules for durable memory maintenance.
- [Wiki log](./log.md): Chronological maintenance log.
- [Wiki state](./state.md): Ingest and maintenance state.
- [Raw sources](./raw/README.md): Rules for untrusted raw inputs.

## Dream history

- [Episode catalog](./dreams/episodes.jsonl): Metadata-only routing to immutable session logs.
- `wiki/dreams/by-spec/<item-id>.md`: Append-only Gamemaster checkpoint ledgers.
- `wiki/dreams/retrospectives/<item-id>.md`: Append-only planning and whole-lifecycle workflow retrospectives.

## Project knowledge

- [Project overview](./overview.md): Purpose, users, deliverable, stack, and repository boundaries.
- [Repository map](./map.md): Entry points, module responsibilities, tests, scripts, and common change locations.
- [Architecture](./architecture.md): Runtime boundaries, request and authentication flows, state ownership, invariants, and tradeoffs.
- [Development](./development.md): Setup, verification, maintenance scripts, generated code, and release workflow.

## Conventions

- [Conventions index](./conventions/index.md): Routing for repository-specific engineering practices.
- [TypeScript and modules](./conventions/typescript-and-modules.md): ESM, compiler, formatting, and module-boundary rules.
- [Testing](./conventions/testing.md): Vitest structure, test seams, fixtures, and coverage expectations.
- [Security and state](./conventions/security-and-state.md): Credential, ingress, session, replay, and debug-data invariants.

## Stale or needs review

- None currently recorded. The initial-ingest schema and type-check gaps were superseded by the tracked generation workflow and focused offline checks for the Cursor MCP protocol repair.
