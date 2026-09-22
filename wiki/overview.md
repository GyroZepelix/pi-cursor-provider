# Project Overview

## Purpose

`@offbynan/pi-cursor-provider` is a Pi extension that exposes Cursor-hosted models through Pi's `openai-completions` provider interface. It performs browser-based Cursor OAuth, discovers available models, and translates local OpenAI-compatible requests into Cursor's protobuf protocol (`package.json`, `README.md`, `index.ts`, `proxy.ts`).

## Users and scope

- Primary users are Pi users with an active Cursor subscription who install the extension and select the `cursor` provider (`README.md`).
- Maintainers update the provider adapter, model routing and estimates, transport reliability, and the bundled fallback catalog (`index.ts`, `model-ids.ts`, `proxy.ts`, `cursor-models-raw.json`).
- The project is an adapter, not a model service. Inference, account access, and live model availability are owned by Cursor (`auth.ts`, `h2-bridge.mjs`).

## Deliverable

The package is source-distributed as an npm Pi extension. `package.json` points Pi at `index.ts` and includes the TypeScript sources, bridge, generated protobuf bindings, model snapshot, selected scripts, and documentation. There is no build output or build script (`package.json`, `README.md`).

## Stack

- Node.js 22.19 or newer, ESM, and strict TypeScript (`package.json`, `tsconfig.json`).
- Pi extension APIs from `@earendil-works/pi-coding-agent` and provider types/transport from `@earendil-works/pi-ai` (`package.json`, `index.ts`).
- Buf protobuf runtime with checked-in generated bindings (`package.json`, `proto/agent_pb.ts`).
- Node HTTP and child processes for the loopback proxy and HTTP/2 bridge (`proxy.ts`, `h2-bridge.mjs`).
- Vitest for co-located test suites (`package.json`, `*.test.ts`).

## Repository boundaries

- Runtime source is at the repository root, with generated protocol bindings under `proto/` and operational scripts under `scripts/`.
- Conversation checkpoints and blobs are process memory. A best-effort discovered model cache is stored under the user's Pi agent directory; the repository contains only the normalized fallback snapshot (`proxy.ts`, `cursor-models-raw.json`).
- Debug logs are opt-in runtime artifacts outside the repository by default and may contain conversation data (`secure-log.ts`, `README.md`).
- No CI configuration, deployment infrastructure, migrations, or application database is tracked at the analysis checkpoint.
