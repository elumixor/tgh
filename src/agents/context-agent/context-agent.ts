import { webSearchTool } from "@openai/agents";
import { type AppContext, StreamingAgent } from "@agents/streaming-agent";
import { driveAgent } from "@agents/drive-agent/drive-agent";
import { memoryAgent } from "@agents/memory-agent/memory-agent";
import { models } from "models";
import { z } from "zod";
import { getGDDPageTool, searchGDDTool } from "./tools";
import { getChatHistoryTool } from "./tools/get-chat-history";
import { getChatInfoTool } from "./tools/get-chat-info";
import { getMessageInfoTool } from "./tools/get-message-info";

const CONTEXT_AGENT_PROMPT = `You are the Context Agent that enriches user requests with all necessary context.

## PRIMARY RESPONSIBILITIES

### 1. INTENTION RESOLUTION (from Telegram)
- Determine what the user wants to do from their message
- Resolve message references: "this message" (replied-to), "that conversation"
- Resolve voice messages (use transcribe_voice: true when needed)
- Clarify ambiguous requests by searching relevant context

Resolution Patterns:
- "this/that message" → use get_message_info with the message ID
- Conversation references → use get_chat_info for chat history
- Voice content → set transcribe_voice: true in get_message_info
- Always gather context before asking for clarification

### 2. INFORMATION GATHERING (from project sources)
- Resolve entities (characters, styles, objects, concepts) mentioned in the request
- Retrieve relevant information from: GDD/Notion (design docs), Memories (persistent context), Drive (assets/files)
- Use web search only as fallback when information isn't found in project-specific sources
- Search priority: GDD/Notion (authoritative design specs) > Memory (project facts) > Drive (assets) > Web (general info)

## TOOL DELEGATION

**Telegram Context:**
- get_message_info: Get message content, media, sender, voice transcription
- get_chat_info: Get chat history and conversation context
- get_chat_history: Get recent message history (last N messages) for conversation continuity

**Project Context:**
- search_gdd: Search the Game Design Document (project documentation in Notion) for design specs, characters, mechanics, etc.
- get_gdd_page: Retrieve full content of a specific GDD/Notion page after searching
- memory_agent: Search, add, or update persistent project memories (facts, decisions, context)
- drive_agent: Search, list, download, upload, or manage Google Drive files (assets, images, documents)
- web_search: Fallback for general information not available in project-specific sources

## OUTPUT REQUIREMENTS

Return comprehensive context including:
- Clarified user intent (what they actually want to do)
- Referenced Telegram messages with IDs and links
- Resolved entities (characters, styles, objects)
- Relevant references from GDD, memories, Drive, chat messages
- Confidence level and any uncertainties
- Whether user clarification is needed

## BEST PRACTICES

- Avoid redundant searches (check memory/GDD before web)
- Always cite sources with URLs/links
- Be concise but thorough
- Do not perform generation - only gather and structure context
- Return actionable, structured information for downstream agents`;

const ContextOutputSchema = z.object({
  clarified_intent: z.string().describe("Clear statement of what the user wants to do"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence in understanding user intent"),
  needs_user_clarification: z.boolean().describe("Whether user input is needed to proceed"),

  referenced_messages: z
    .array(z.object({ id: z.number(), link: z.string(), snippet: z.string() }))
    .describe("Telegram messages referenced in the request"),

  entities: z
    .object({
      characters: z.array(z.string()),
      styles: z.array(z.string()),
      objects: z.array(z.string()),
    })
    .describe("Entities (characters, styles, objects) mentioned in the request"),

  references: z
    .object({
      GDD_pages: z.array(z.string()).describe("Relevant GDD/Notion page URLs"),
      memories: z.array(z.string()).describe("Relevant memory IDs or descriptions"),
      Drive_files: z.array(z.string()).describe("Relevant Google Drive file names/IDs"),
      chat_messages: z.array(z.string()).describe("Relevant chat message references"),
    })
    .describe("External references from project sources"),

  assumptions: z.array(z.string()).describe("Assumptions made during context gathering"),
  uncertainties: z.array(z.string()).describe("Things that are unclear or need verification"),
});

export const contextAgent = new StreamingAgent<AppContext>({
  name: "context_agent",
  model: models.thinking,
  instructions: CONTEXT_AGENT_PROMPT,
  tools: [
    getMessageInfoTool,
    getChatInfoTool,
    getChatHistoryTool,
    searchGDDTool,
    getGDDPageTool,
    {
      agent: memoryAgent,
      description:
        "Search, add, or update project memories. Use this to store and retrieve persistent information about the project, characters, decisions, and context.",
    },
    {
      agent: driveAgent,
      description:
        "Search, list, download, upload, or manage Google Drive files. Use this to access project assets, documents, and files stored in Drive.",
    },
    webSearchTool(),
  ],
  outputType: ContextOutputSchema,
});
