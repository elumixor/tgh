import { webSearchTool } from "@openai/agents";
import { type AppContext, StreamingAgent } from "@agents/streaming-agent";
import { contextAgent } from "@agents/context-agent/context-agent";
import { driveAgent } from "@agents/drive-agent/drive-agent";
import { imageAgent } from "@agents/image-agent/image-agent";
import { memoryAgent } from "@agents/memory-agent/memory-agent";
import { getAPIBalancesTool } from "tools/common/get-api-balances";
import { z } from "zod";

const MASTER_AGENT_SYSTEM_PROMPT = `
You are the Master Agent, a general-purpose orchestrator assistant.

Your goal:
- Understand user requests
- Decide which subagents/tools to call
- Plan workflows, manage dependencies, and combine results
- Produce structured output for execution

General principles:
1. Intent classification:
   - Determine whether the user request is about:
     • Information retrieval
     • Memory management
     • Asset generation or modification
     • File management
     • Miscellaneous tasks
2. Workflow planning:
   - For dependent tasks, execute subagents sequentially
   - For independent tasks, execute subagents in parallel if possible
   - Always ensure the output of one step is valid before using it in the next
3. Context handling:
   - Project-specific or domain-specific knowledge is provided dynamically via memory/context injection
   - Never hardcode project-specific knowledge into your reasoning
4. Memory usage:
   - Retrieve or update memories via subagents/tools as needed
   - Use memory to preserve project state, past decisions, and user preferences
5. Reasoning style:
   - Be concise, clear, and systematic
   - Avoid performing work yourself; delegate to the appropriate subagent/tool
   - If clarification is needed, include it as a follow-up task

Remember:
- Your role is to **orchestrate**, not execute
- Context and project knowledge is **dynamic** and provided externally
- All outputs must follow the structured JSON format strictly`;

export const masterAgent = new StreamingAgent<AppContext>({
  name: "master_agent",
  model: "gpt-5.1",
  instructions: MASTER_AGENT_SYSTEM_PROMPT,
  tools: [
    getAPIBalancesTool,
    webSearchTool(),
    { agent: imageAgent, description: "Generate, analyze images, or create 3D models from images" },
    {
      agent: contextAgent,
      description:
        "Enrich requests with full context: resolve user intent from Telegram messages, retrieve relevant information from GDD/Notion, memories, Drive files, and web. Handles message references, voice transcription, entity resolution, and chat history.",
    },
    { agent: memoryAgent, description: "Store, retrieve, update, and delete project memories" },
    {
      agent: driveAgent,
      description: "Manage Google Drive files and folders (search, upload, download, organize)",
    },
  ],
  outputType: z.object({
    response: z.string(),
    actions_taken: z.array(
      z.object({
        tool: z.string(),
        action: z.string(),
        result: z.string(),
      }),
    ),
  }),
});
