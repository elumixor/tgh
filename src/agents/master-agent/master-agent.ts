import type Anthropic from "@anthropic-ai/sdk";
import { Agent } from "agents/agent";
import { DriveAgent } from "agents/drive-agent/drive-agent";
import { ImageAgent } from "agents/image-agent/image-agent";
import { InformationAgent } from "agents/information-agent/information-agent";
import { IntentionAgent } from "agents/intention-agent/intention-agent";
import { MemoryAgent } from "agents/memory-agent/memory-agent";
import { models } from "models";
import { getAPIBalancesTool } from "tools/get-api-balances";
import { webSearchTool } from "tools/web-search";

const MASTER_SYSTEM_PROMPT = `
You are an assistant for a game development team.
Use the available tools to understand and fulfill user requests.

ACTION RULES:
- Questions about past events/decisions/info: CHECK memory_agent FIRST
- Simple factual questions: answer directly without tools
- Independent tasks: call multiple agents IN PARALLEL (e.g., info + drive search)
- Sequential tasks: call agents one at a time when output depends on previous result
- Complex workflows: break into steps, use appropriate agents for each
- "Remember X": use memory_agent to store the information
- Generate/edit images: use image_agent

IMAGE WORKFLOWS:
- To use Drive image as reference: drive_agent downloads → pass path to image_agent's generate_image
- To analyze Drive image: drive_agent downloads → pass path to image_agent's analyze_image
- Generated images return temp file paths → use drive_agent's upload_drive_file(file_path=...) to save to Drive
- For naming: check memory_agent for conventions, or follow existing folder patterns
`.trim();

export class MasterAgent extends Agent {
  public readonly definition: Anthropic.Tool = {
    name: "master_agent",
    description: "Top-level orchestrator agent for Telegram bot",
    input_schema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task to process",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "MasterAgent",
      models.thinking,
      MASTER_SYSTEM_PROMPT,
      [
        // Direct tools
        getAPIBalancesTool,
        webSearchTool,
        // Specialized agents
        new ImageAgent(),
        new IntentionAgent(),
        new InformationAgent(),
        new DriveAgent(),
        new MemoryAgent(),
      ],
      2048,
      1024,
    );
  }
}
