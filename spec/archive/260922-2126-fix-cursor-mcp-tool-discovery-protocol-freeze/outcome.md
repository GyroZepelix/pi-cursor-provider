# Outcome: Fix Cursor MCP tool discovery protocol freeze

Work item: `260922-2126-fix-cursor-mcp-tool-discovery-protocol-freeze`
Disposition: Completed
Date: 2026-09-22

## Delivered scope

- Vendored and attributed the pinned complete Cursor `agent.proto`, retained exactly three local compatibility declarations, pinned the approved generator, and added deterministic regeneration.
- Implemented field-36 MCP state discovery from the advertised Pi tool catalog while preserving `mcpArgs` as the only Pi-delegated exec path.
- Replaced guessed unsupported responses with sanitized terminal protocol failures, independent control-exec watchdog ownership, pre-turn checkpoint restoration, idempotent bridge cleanup, and inert late callbacks.
- Added protocol, fake-bridge, lifecycle, debug-timeline, packaging, and regression coverage plus README and durable wiki maintenance guidance.

## Deviations from plan

- None. The optional live Cursor smoke was not authorized and was truthfully skipped; it was not a completion requirement.

## Verification summary

- Deterministic regeneration and the complete prior-binding field comparison passed.
- Focused protocol/lifecycle/timeline checks passed with 176 tests; the full offline suite passed with 544 tests.
- Isolated package smoke, `npm pack --dry-run`, repository hygiene, documentation checks, and operational spec validation passed.
- The focused segment and final contract-quality reviews each passed after one targeted correction and re-review.

## Retained, reverted, or transferred work

- All plan-conforming implementation, test, documentation, attribution, and verification work is retained.
- No unrelated work was encountered, reverted, staged, committed, transferred, or discarded.

## Residual risks

- Cursor's protocol is not a supported public API; future wire changes may require another pinned schema review.
- No live authenticated Cursor request was run, so offline evidence does not claim model-wide live coverage.

## Follow-up work items

- None required. A separately approved synthetic live smoke may be run later if additional live confidence is desired.

## Source references

- Pinned schema source: <https://github.com/can1357/oh-my-pi/blob/1b220a4f65554ffb3a505a5df92a2eebf2d60545/packages/ai/src/providers/cursor/proto/agent.proto>
- Compatible MCP state behavior: <https://github.com/can1357/oh-my-pi/blob/1b220a4f65554ffb3a505a5df92a2eebf2d60545/packages/ai/src/providers/cursor/exec-modern.ts>
- Local provenance: `proto/ATTRIBUTION.md`
- Detailed evidence: `verification.md`

## Wiki updates

- Updated architecture, development, testing, and security/state guidance with the verified generation, MCP discovery, fail-closed dispatch, watchdog, diagnostics, and lifecycle behavior.
- Marked the raw handoff processed in `wiki/state.md` and recorded the focused ingest in `wiki/log.md`.
