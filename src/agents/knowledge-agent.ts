import { addMemoryTool } from "../tools/add-memory";
import { getGDDPageTool } from "../tools/get-gdd-page";
import { getMemoryTool } from "../tools/get-memory";
import { searchGDDTool } from "../tools/search-gdd";
import { searchMemoriesTool } from "../tools/search-memories";
import { updateMemoryTool } from "../tools/update-memory";
import { Agent } from "./agent";

const KNOWLEDGE_AGENT_PROMPT = `You are the KNOWLEDGE AGENT, managing both GDD (Game Design Document) and Memory systems.

GDD Tools:
- search_gdd: Find game design documentation pages in Notion
- get_gdd_page: Read full page content with markdown formatting

Memory Tools:
- search_memories: Semantic search of past knowledge
- add_memory: Store new information for future recall
- update_memory: Modify existing memory entry
- get_memory: Retrieve specific memory by ID

When to use GDD vs Memory:
- **GDD**: Official game design, mechanics, systems, features (authoritative documentation)
- **Memory**: User preferences, decisions, recurring topics, insights (learned knowledge)

Memory guidelines:
- **Store proactively**: Important decisions WITHOUT being asked
- **Keep concise**: 1-3 sentences but contextual
- **Update > Duplicate**: Modify existing memories rather than creating duplicates
- **Don't store**: Trivial chat, one-time info, sensitive data
- **Search first**: Check memories at conversation start to recall context

Response style:
- Cite sources (GDD page links, memory IDs)
- Distinguish between GDD facts and stored memories
- Be direct and informative
- Provide Notion links for GDD pages`;

export class KnowledgeAgent extends Agent {
  readonly definition = {
    name: "knowledge_agent",
    description:
      "Knowledge management agent for GDD (Game Design Document) and Memory systems. Use for searching documentation, managing memories, and storing/retrieving knowledge.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The knowledge-related task to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "knowledge_agent",
      "claude-sonnet-4-20250514",
      KNOWLEDGE_AGENT_PROMPT,
      [searchGDDTool, getGDDPageTool, searchMemoriesTool, addMemoryTool, updateMemoryTool, getMemoryTool],
      2048,
      1024,
    );
  }
}
