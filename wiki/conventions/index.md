# Conventions

Repository-specific conventions are supported by configuration, explicit runtime guards, or repeated test patterns.

- [TypeScript and modules](./typescript-and-modules.md): ESM import style, strict compiler constraints, formatting, and generated-code boundary from `package.json`, `tsconfig.json`, `.editorconfig`, and representative source files.
- [Testing](./testing.md): Vitest organization, fixture isolation, bridge/proxy test seams, and behavioral coverage from `package.json` and the co-located `*.test.ts` suites.
- [Security and state](./security-and-state.md): credential separation, ingress validation, session lifecycle, retry safety, and debug-log handling from `proxy.ts`, `index.ts`, `secure-log.ts`, and `security.test.ts`.
