import { Agent } from "agents/agent";
import { models } from "models";
import { getChatHistoryTool } from "tools/get-chat-history";
import { searchMessagesTool } from "tools/search-messages";
import { getChatInfoTool } from "./tools/get-chat-info";
import { getMessageInfoTool } from "./tools/get-message-info";

const INTENTION_AGENT_PROMPT = `You understand user intention from Telegram messages.

Core Task:
- Determine what the user wants to do from their message
- Resolve message references: "this message" (replied-to), "that conversation"
- Clarify ambiguous requests by searching relevant context

When to Activate:
- ONLY when user intention is unclear or ambiguous
- When message contains vague references that need resolution
- When context from other messages would clarify intent

Resolution Patterns:
- "this/that message" → check messageId, use get_message_info
- Conversation references → search keywords, get chat history
- Voice content → set transcribe_voice: true
- Always gather context before asking for clarification

Guidelines:
- get_message_info is your primary tool for message references
- Search uses AND logic (all terms required)
- Return concise intention summary with message IDs and links`;

export class IntentionAgent extends Agent {
  readonly definition = {
    name: "intention_agent",
    description:
      "User intention understanding agent. Use ONLY when user request is unclear or contains ambiguous references that need resolution. Not needed for straightforward requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The ambiguous user request that needs intention clarification",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "intention_agent",
      models.thinking,
      INTENTION_AGENT_PROMPT,
      [searchMessagesTool, getChatHistoryTool, getMessageInfoTool, getChatInfoTool],
      2048,
      1024,
    );
  }
}
