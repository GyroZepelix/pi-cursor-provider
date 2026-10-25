import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { BinaryWriter, WireType } from "@bufbuild/protobuf/wire";
import { describe, expect, test } from "vitest";
import {
  AgentClientMessageSchema,
  AgentServerMessageSchema,
  ExecClientControlMessageSchema,
  ExecClientMessageSchema,
  ExecClientStreamCloseSchema,
  ExecClientThrowSchema,
  ExecServerAbortSchema,
  ExecServerControlMessageSchema,
  InteractionResponseSchema,
  WebSearchRequestResponse_ApprovedSchema,
  WebSearchRequestResponseSchema,
  ExecServerMessageSchema,
  McpStateExecArgsSchema,
  McpStateExecResultSchema,
  McpStateSuccessSchema,
  McpToolDefinitionSchema,
} from "./proto/agent_pb.ts";
import { __testInternals } from "./proxy.ts";

describe("Cursor exec protocol bindings", () => {
  test("field 36 decodes and encodes MCP state with field-55 metadata", () => {
    const server = create(ExecServerMessageSchema, {
      id: 17,
      execId: "state-17",
      acceptHookAdditionalContexts: true,
      message: {
        case: "mcpStateExecArgs",
        value: create(McpStateExecArgsSchema, {
          serverIdentifiers: ["pi"],
          kickOnly: true,
        }),
      },
    });

    const decodedServer = fromBinary(
      ExecServerMessageSchema,
      toBinary(ExecServerMessageSchema, server),
    );
    expect(decodedServer.id).toBe(17);
    expect(decodedServer.execId).toBe("state-17");
    expect(decodedServer.acceptHookAdditionalContexts).toBe(true);
    expect(decodedServer.message.case).toBe("mcpStateExecArgs");
    if (decodedServer.message.case !== "mcpStateExecArgs") throw new Error("unexpected case");
    expect(decodedServer.message.value.serverIdentifiers).toEqual(["pi"]);
    expect(decodedServer.message.value.kickOnly).toBe(true);

    const client = create(ExecClientMessageSchema, {
      id: decodedServer.id,
      execId: decodedServer.execId,
      message: {
        case: "mcpStateExecResult",
        value: create(McpStateExecResultSchema, {
          result: {
            case: "success",
            value: create(McpStateSuccessSchema, { servers: [] }),
          },
        }),
      },
    });
    const decodedClient = fromBinary(
      ExecClientMessageSchema,
      toBinary(ExecClientMessageSchema, client),
    );
    expect(decodedClient.message.case).toBe("mcpStateExecResult");
    expect(decodedClient.id).toBe(17);
    expect(decodedClient.execId).toBe("state-17");
  });

  test("MCP state groups tools stably, filters requested servers, and omits empty identifiers", () => {
    const tools = [
      create(McpToolDefinitionSchema, { name: "a1", toolName: "a1", providerIdentifier: "alpha" }),
      create(McpToolDefinitionSchema, { name: "ignored", toolName: "ignored", providerIdentifier: "" }),
      create(McpToolDefinitionSchema, { name: "b1", toolName: "b1", providerIdentifier: "beta" }),
      create(McpToolDefinitionSchema, { name: "a2", toolName: "a2", providerIdentifier: "alpha" }),
    ];
    const all = __testInternals.buildMcpStateResult(tools, []);
    if (all.result.case !== "success") throw new Error("unexpected result");
    expect(all.result.value.servers.map((server) => server.serverIdentifier)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(all.result.value.servers[0]!.tools.map((tool) => tool.name)).toEqual(["a1", "a2"]);
    expect(all.result.value.servers.every((server) =>
      server.serverName === server.serverIdentifier &&
      server.status === "connected" &&
      server.plugin === undefined &&
      server.marketplace === undefined &&
      server.instructions.length === 0)).toBe(true);

    const filtered = __testInternals.buildMcpStateResult(tools, ["beta"]);
    if (filtered.result.case !== "success") throw new Error("unexpected result");
    expect(filtered.result.value.servers.map((server) => server.serverIdentifier)).toEqual(["beta"]);

    const absent = __testInternals.buildMcpStateResult(tools, ["missing"]);
    if (absent.result.case !== "success") throw new Error("unexpected result");
    expect(absent.result.value.servers).toEqual([]);
  });

  test("unknown exec metadata is reduced to field number, wire type, and byte length", () => {
    const privatePayload = new TextEncoder().encode("do-not-log-this");
    const bytes = new BinaryWriter()
      .tag(1, WireType.Varint)
      .uint32(23)
      .tag(15, WireType.LengthDelimited)
      .string("future-23")
      .tag(60, WireType.LengthDelimited)
      .bytes(privatePayload)
      .finish();
    const decoded = fromBinary(ExecServerMessageSchema, bytes);

    expect(decoded.message.case).toBeUndefined();
    expect(__testInternals.summarizeUnknownFields(decoded)).toEqual([
      {
        fieldNumber: 60,
        wireType: WireType.LengthDelimited,
        byteLength: privatePayload.byteLength + 1,
      },
    ]);
    expect(JSON.stringify(__testInternals.summarizeUnknownFields(decoded))).not.toContain(
      "do-not-log-this",
    );
  });

  test("field 36 remains nested correctly in an AgentServerMessage", () => {
    const execBytes = toBinary(ExecServerMessageSchema, create(ExecServerMessageSchema, {
      id: 4,
      execId: "nested",
      message: {
        case: "mcpStateExecArgs",
        value: create(McpStateExecArgsSchema, {}),
      },
    }));
    const agentBytes = new BinaryWriter()
      .tag(2, WireType.LengthDelimited)
      .bytes(execBytes)
      .finish();
    const decoded = fromBinary(AgentServerMessageSchema, agentBytes);
    expect(decoded.message.case).toBe("execServerMessage");
    if (decoded.message.case !== "execServerMessage") throw new Error("unexpected case");
    expect(decoded.message.value.message.case).toBe("mcpStateExecArgs");
  });

  test("exec control and interaction replies use the vendored field numbers", () => {
    // AgentClientMessage.exec_client_control_message = 5 { stream_close = 1 { id = 1 } }
    const streamClose = toBinary(AgentClientMessageSchema, create(AgentClientMessageSchema, {
      message: { case: "execClientControlMessage", value: create(ExecClientControlMessageSchema, {
        message: { case: "streamClose", value: create(ExecClientStreamCloseSchema, { id: 7 }) },
      }) },
    }));
    expect(Array.from(streamClose)).toEqual([0x2a, 0x04, 0x0a, 0x02, 0x08, 0x07]);

    // ExecClientControlMessage.throw = 2 { id = 1, error = 2 }
    const thrown = toBinary(AgentClientMessageSchema, create(AgentClientMessageSchema, {
      message: { case: "execClientControlMessage", value: create(ExecClientControlMessageSchema, {
        message: { case: "throw", value: create(ExecClientThrowSchema, { id: 7, error: "x" }) },
      }) },
    }));
    expect(Array.from(thrown)).toEqual([0x2a, 0x07, 0x12, 0x05, 0x08, 0x07, 0x12, 0x01, 0x78]);

    // AgentClientMessage.interaction_response = 6 { id = 1, web_search_request_response = 2 { approved = 1 } }
    const approved = toBinary(AgentClientMessageSchema, create(AgentClientMessageSchema, {
      message: { case: "interactionResponse", value: create(InteractionResponseSchema, {
        id: 3,
        result: { case: "webSearchRequestResponse", value: create(WebSearchRequestResponseSchema, {
          result: { case: "approved", value: create(WebSearchRequestResponse_ApprovedSchema, {}) },
        }) },
      }) },
    }));
    expect(Array.from(approved)).toEqual([0x32, 0x06, 0x08, 0x03, 0x12, 0x02, 0x0a, 0x00]);

    // AgentServerMessage.exec_server_control_message = 5 { abort = 1 { id = 1 } }
    const abort = fromBinary(AgentServerMessageSchema, new Uint8Array([0x2a, 0x04, 0x0a, 0x02, 0x08, 0x09]));
    expect(abort.message.case).toBe("execServerControlMessage");
    if (abort.message.case !== "execServerControlMessage") throw new Error("unexpected case");
    expect(abort.message.value.message).toEqual(
      create(ExecServerControlMessageSchema, { message: { case: "abort", value: create(ExecServerAbortSchema, { id: 9 }) } }).message,
    );
  });
});
