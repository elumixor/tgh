import { coreTools } from "@tools/core";
import { cancelSignTool, sendForSignTool } from "@tools/signing";
import { skillTools } from "@tools/skills";
import { models } from "models";
import { memories } from "services/memories";
import { skills } from "services/skills";
import { StreamingAgent } from "streaming-agent";
import { updateMemoriesTool } from "tools/core/update-memories";
import { driveAgent } from "tools/drive";
import { notionAgent } from "tools/notion";

export const masterAgent = new StreamingAgent({
  name: "MasterAgent",
  model: models.thinking,
  modelSettings: { reasoning: { effort: "medium" } },
  instructions: ({ chatType, chatName, botUsername, botName }) =>
    `
You are ${botName} (${botUsername}), a Telegram bot assistant.

## Current Chat

You are currently in a ${chatType} chat: "${chatName}".
${chatType === "group" ? "This is the main group chat. You can also access private chat history using the tools." : "This is a private chat. You can also access group chat history using the tools."}

## Behavior

- Understand user requests from the chat context provided
- Use tools and sub-agents to accomplish tasks when needed

## Memories

${memories.get() ?? "(no memories yet)"}

Use ${updateMemoriesTool.name} tool when:
- User explicitly asks you to remember something
- User provides feedback about preferences
- Important context should be persisted

The tool accepts an instruction in natural language (e.g., "add preference for concise responses", "remove the item about X").
${skills.getPromptSection()}
## Output Format

- Be concise and direct in responses
- Respond in valid markdown format
- For links, always use the valid format: \`[link text](URL)\` format. Never output raw URLs.

## Message History and Context

The chat content shows the last few messages (oldest first) in the XML format.
Between the user messages there could be different changes in the world, code, systems.
You need not rely on old messages to provide constant results. The system might have changed since then.
`.trim(),
  tools: [
    ...coreTools,
    {
      agent: notionAgent,
      description:
        "Manages requests related to Notion. Accepts a general instruction in a natural language with required ids/links/names. Use it to delegate any Notion/notion related requests",
    },
    {
      agent: driveAgent,
      description:
        "Manage Google Drive and Google Docs. Accepts a general instruction in a natural language with required ids/links/names.",
    },
    sendForSignTool,
    cancelSignTool,
    ...skillTools,
    // {
    //   agent: onboardingAgent,
    //   description:
    //     "Coordinate team member onboarding - create Notion entries, generate NDAs, send for signature, add to Telegram",
    // },
    // getAPIBalancesTool,
    // webSearchTool(),
    // { agent: imageAgent, description: "Generate, analyze images, or create 3D models from images" },
    // {
    //   agent: contextAgent,
    //   description: "Enrich requests with full context: resolve user intent from Telegram messages, retrieve relevant information from GDD/Notion, Drive files, and web.",
    // },
  ],
});
