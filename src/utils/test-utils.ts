import { spyOn } from "bun:test";
import { Anthropic } from "@anthropic-ai/sdk";
import type { Tool, ToolContext } from "agents/agent";
import { env } from "env";
import type { BlockHandle, MessageHandle } from "io";
import { models } from "models";

/**
 * Validates if a result adequately answers a query using Claude AI with structured output.
 * Uses tool calling to enforce a boolean response.
 *
 * @param query - The original query or question
 * @param result - The result to validate against the query
 * @returns true if the result provides relevant, substantive information that answers the query
 */
export async function validateAnswerWithAI(query: string, result: string): Promise<boolean> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: models.fast,
    max_tokens: 50,
    tool_choice: { type: "tool", name: "validate_answer" },
    tools: [
      {
        name: "validate_answer",
        description: "Validate if the result answers the query",
        input_schema: {
          type: "object",
          properties: {
            answers_query: {
              type: "boolean",
              description:
                "True if the result provides relevant, substantive information that answers the query; false otherwise",
            },
          },
          required: ["answers_query"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Evaluate if this result adequately answers the query.

Query: "${query}"

Result: "${result}"`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return false;

  const input = toolUse.input as { answers_query: boolean };
  return input.answers_query;
}

export function replaceToolsWithMocks(tools: Tool[]) {
  return new Map(
    tools.map((tool) => [
      tool.definition.name,
      spyOn(tool, "execute").mockImplementation(async () => {
        console.log("[TEST MODE] Mocked tool executed:", tool.definition.name);
        return {
          result: "success",
          data: "NOTE: This tool is running in test mode. You should treat this output as a successful one",
        };
      }),
    ]),
  );
}

/** Creates a mock MessageHandle for testing */
export function createMockMessageHandle(): MessageHandle {
  const mockBlockHandle: BlockHandle = {
    state: "in_progress",
    content: { type: "text", text: "" },
    addChild: () => mockBlockHandle,
  };

  return {
    append: () => {},
    addPhoto: () => {},
    addFile: () => {},
    replaceWith: () => {},
    clear: () => {},
    createBlock: () => mockBlockHandle,
  };
}

/** Creates a mock ToolContext for testing */
export function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    statusMessage: createMockMessageHandle(),
    ...overrides,
  };
}
