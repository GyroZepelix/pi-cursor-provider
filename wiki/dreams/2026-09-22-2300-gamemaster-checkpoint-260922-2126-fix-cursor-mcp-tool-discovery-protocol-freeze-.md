---
schema_version: 1
episode_id: "2026-09-22-2300-gamemaster-checkpoint-260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze-"
timestamp: "2026-09-22T23:00:14+02:00"
summary: "Repaired Cursor MCP field-36 discovery with reproducible bindings, fail-closed terminal handling, bounded cleanup, and complete offline evidence."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze"
current: "direct"
topics: ["Cursor protocol","MCP discovery","lifecycle reliability"]
---

# Gamemaster checkpoint: 260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze/direct

Date: 2026-09-22
Work item: 260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze
Status: shipped
In one line: Repaired Cursor MCP field-36 discovery with reproducible bindings, fail-closed terminal handling, bounded cleanup, and complete offline evidence.

## Goal

Make Cursor tool-enabled requests complete dynamic MCP discovery instead of freezing, while bounding unsupported protocol messages with sanitized terminal errors and exact-once lifecycle cleanup.

## How we approached it

The implementation first established a pinned, attributed `agent.proto` and deterministic `protoc-gen-es` workflow, then reviewed compatibility against the prior generated binding. Runtime dispatch was changed to answer MCP state locally, leave only real `mcpArgs` calls on Pi's continuation path, and terminate unsupported decoded or unknown exec cases. Independent control-exec watchdog ownership, bridge disposal guards, pre-turn checkpoint restoration, sanitized timeline events, focused fixtures, full regression checks, package smoke, and dry-run packaging completed the repair. The completed work item was archived only after medium-assurance review and explicit terminal approval.

## Key decisions

- **Schema provenance** - used the complete schema pinned to oh-my-pi commit `1b220a4f65554ffb3a505a5df92a2eebf2d60545` with exactly three documented compatibility declarations; rejected hand-editing generated descriptor fragments.
- **MCP ownership** - answered field-36 state discovery from the advertised tool catalog inside the provider; retained `mcpArgs` as the sole Pi-delegated exec case.
- **Protocol drift** - chose terminal fail-closed behavior with metadata-only unknown-field diagnostics; rejected guessed or empty result cases that could recreate a pending request.
- **Lifecycle evidence** - required idempotent disposal, inert late frames, and restoration of the pre-turn checkpoint before accepting completion.

## What did not work

- **Initial regenerated type-check** - new generated enums conflicted with `erasableSyntaxOnly`; the supported generator option `ts_nocheck=true` was added to the reproducible command.
- **First focused review** - found cleanup could be repeated and late frames could re-enter state; centralized disposed and killed bridge ownership fixed the failure path.
- **First final review** - found an in-turn checkpoint could survive terminal protocol failure; both response modes now restore a byte copy of the pre-turn checkpoint and test a distinct intervening checkpoint.
- **Initial helper invocation** - combined mutually exclusive spec validation modes; the corrected operational command passed without warnings.

## Current state and where we left off

- Shipped/verified: the archived item is `completed`; deterministic generation, 176 focused tests, 544 full-suite tests, isolated package smoke, dry-run packaging, repository hygiene, both review gates, and operational spec validation passed.
- Pending: no implementation work remains. The optional authenticated live Cursor smoke was not authorized and was not run.

## Source of truth

- `spec/archive/260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze/plan.md`: accepted contract and completed tasks.
- `spec/archive/260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze/verification.md`: commands, failures, review retries, and residual uncertainty.
- `spec/archive/260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze/outcome.md`: delivered scope and final disposition.
- `proto/ATTRIBUTION.md`: pinned schema source, license, and local compatibility declarations.

## Verification

- Done: deterministic protobuf regeneration; prior binding comparison; focused and full Vitest suites; type-check; package smoke; dry-run pack; whitespace, documentation, archive, and operational validation checks.
- Not verified yet: live authenticated Cursor behavior and coverage across future wire revisions or every Cursor model.

## Open questions, blockers, next safe action

- Open/blocked: none. Cursor's unsupported public protocol remains the documented residual compatibility risk.
- Next safe action: review the preserved working-tree diff and create a user-controlled Git checkpoint if desired.

## Dynamic knowledge trail

- `wiki/architecture.md`: topic-specific dynamic knowledge.
- `wiki/development.md`: topic-specific dynamic knowledge.
- `wiki/conventions/testing.md`: convention.
- `wiki/conventions/security-and-state.md`: convention.
