# TypeScript and Module Conventions

## Module and compiler rules

- The package is ESM (`"type": "module"`). TypeScript uses `NodeNext` module and resolution modes with `noEmit`, `strict`, `isolatedModules`, `erasableSyntaxOnly`, and `noUncheckedIndexedAccess` (`package.json`, `tsconfig.json`).
- TypeScript source imports local modules with `.js` specifiers even though source files end in `.ts`, for example `index.ts` imports `./auth.js` and `./proxy.js`.
- Use `import type` for type-only dependencies. This pattern is repeated across `index.ts`, `proxy.ts`, and tests and is compatible with isolated modules.
- JSON modules use an import attribute, as in `cursor-models-raw.json` imports in `index.ts` and `model-ids.ts`.

## Formatting

`.editorconfig` requires UTF-8, LF endings, a final newline, spaces, two-space indentation, and trimmed trailing whitespace outside Markdown. Markdown may retain trailing whitespace (`.editorconfig`).

## Boundaries

- Keep Pi provider registration and extension hooks in `index.ts`; keep protocol adaptation and session state in `proxy.ts` (`index.ts`, `proxy.ts`).
- Put stable model-ID parsing and routing rules in `model-ids.ts` rather than duplicating suffix logic (`model-ids.ts`, `index.ts`, `proxy.ts`).
- `proto/agent_pb.ts` is generated and marked `@ts-nocheck`; do not apply hand-written style rules or direct edits there.
- Runtime configuration is read from `PI_CURSOR_*` environment variables. Preserve documented defaults and add focused tests when changing them (`README.md`, `proxy.ts`, `h2-bridge.mjs`).
