import type Anthropic from "@anthropic-ai/sdk";
import { Agent } from "agents/agent";
import { DriveAgent } from "agents/drive-agent/drive-agent";
import { ImageAgent } from "agents/image-agent/image-agent";
import { InformationAgent } from "agents/information-agent/information-agent";
import { IntentionAgent } from "agents/intention-agent/intention-agent";
import { models } from "models";
import { getAPIBalancesTool } from "tools/get-api-balances";
import { webSearchTool } from "tools/web-search";

const MASTER_SYSTEM_PROMPT = `
You are a Telegram bot that acts as assistant for the game development company ATMA.
Your main task is to help create the game "Hypocrisy".
You should use all the tools available to understand and fulfill user's request.
If you can answer without tool calling, you should do it.
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
      models.fast,
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
      ],
      2048,
    );
  }
}
