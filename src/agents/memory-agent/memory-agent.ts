import { type AppContext, StreamingAgent } from "@agents/streaming-agent";
import { models } from "models";
import { z } from "zod";
import { addMemoryTool } from "./tools/add-memory";
import { deleteMemoryTool } from "./tools/delete-memory";
import { listMemoriesTool } from "./tools/list-memories";
import { searchMemoriesTool } from "./tools/search-memories";
import { updateMemoryTool } from "./tools/update-memory";

const MEMORY_AGENT_PROMPT = `You manage persistent memory storage.

ACTION RULES:
- Store: use add_memory for new facts, decisions, or information to remember
- Recall: use search_memories to find relevant past memories
- List: use list_memories to see all stored memories
- Update: use update_memory to modify existing memories
- Retrieve: use get_memory for specific memory by ID
- Delete: use delete_memory to remove a memory (search first to get the ID)

Memories persist across sessions and are searchable by meaning.`;

const MemoryOutputSchema = z.object({
  action: z.enum(["stored", "retrieved", "updated", "deleted", "listed"]),
  memories: z.array(
    z.object({
      id: z.string().optional(),
      content: z.string(),
      relevance: z.number().optional(),
    }),
  ),
  summary: z.string(),
});

export const memoryAgent = new StreamingAgent<AppContext>({
  name: "memory_agent",
  model: models.fast,
  instructions: MEMORY_AGENT_PROMPT,
  tools: [searchMemoriesTool, listMemoriesTool, addMemoryTool, updateMemoryTool, deleteMemoryTool],
  outputType: MemoryOutputSchema,
});
