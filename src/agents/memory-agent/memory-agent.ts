import { Agent } from "agents/agent";
import { models } from "models";
import { addMemoryLocalTool } from "./tools/add-memory";
import { deleteMemoryLocalTool } from "./tools/delete-memory";
import { getMemoryLocalTool } from "./tools/get-memory";
import { searchMemoriesLocalTool } from "./tools/search-memories";
import { updateMemoryLocalTool } from "./tools/update-memory";

const MEMORY_AGENT_PROMPT = `You manage persistent memory storage.

ACTION RULES:
- Store: use add_memory for new facts, decisions, or information to remember
- Recall: use search_memories to find relevant past memories
- Update: use update_memory to modify existing memories
- Retrieve: use get_memory for specific memory by ID
- Delete: use delete_memory to remove a memory (search first to get the ID)

Memories persist across sessions and are searchable by meaning.`;

export class MemoryAgent extends Agent {
  readonly definition = {
    name: "memory_agent",
    description:
      "Memory management agent. Use to store, search, and retrieve persistent memories. Memories are searchable by semantic similarity.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The memory operation to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "memory_agent",
      models.fast,
      MEMORY_AGENT_PROMPT,
      [searchMemoriesLocalTool, addMemoryLocalTool, getMemoryLocalTool, updateMemoryLocalTool, deleteMemoryLocalTool],
      2048,
    );
  }
}
