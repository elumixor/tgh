import { Agent } from "agents/agent";
import { searchDriveFilesTool } from "agents/drive-agent/tools/search-drive-files";
import { models } from "models";
import { getChatHistoryTool } from "tools/get-chat-history";
import { searchMessagesTool } from "tools/search-messages";
import { webSearchTool } from "tools/web-search";
import { addMemoryTool } from "./tools/add-memory";
import { getGDDPageTool } from "./tools/get-gdd-page";
import { getMemoryTool } from "./tools/get-memory";
import { searchGDDTool } from "./tools/search-gdd";
import { searchMemoriesTool } from "./tools/search-memories";
import { updateMemoryTool } from "./tools/update-memory";

const INFORMATION_AGENT_PROMPT = `You retrieve information from multiple sources for the "Hypocrisy" game development team.

Sources & Usage:
- GDD (Notion): Game design, mechanics, features, project tasks - AUTHORITATIVE
- Memory: User preferences, decisions, learned context - CONVERSATIONAL
- Web (Perplexity): Current info, external libraries - SUPPLEMENTARY
- Drive: Files in "Hypocrisy" folder (ID: 1WtB8aX6aH5s0_fS6xoQPc_0QOC9Hg5ok)
- Messages: Chat history and message search in current Telegram chat

Memory Management:
- Search first at conversation start for context
- Store proactively: important decisions, design changes
- Update over duplicate when information evolves
- Keep contextual: 1-3 sentences with details

Guidelines:
- Always cite sources (GDD URLs, memory IDs, web links, message IDs)
- Distinguish source types in responses
- Search before claiming "not found"`;

export class InformationAgent extends Agent {
  readonly definition = {
    name: "information_agent",
    description:
      "Answers ANY query by searching the web, GDD in Notion, Google Drive, Telegram chat messages history. Use for complex questions, not just for web search.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "Question to be answered",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "information_agent",
      models.thinking,
      INFORMATION_AGENT_PROMPT,
      [
        searchGDDTool,
        getGDDPageTool,
        searchMemoriesTool,
        addMemoryTool,
        updateMemoryTool,
        getMemoryTool,
        webSearchTool,
        searchDriveFilesTool,
        searchMessagesTool,
        getChatHistoryTool,
      ],
      4096,
      2048,
    );
  }
}
