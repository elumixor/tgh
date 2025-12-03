import { getChatInfoTool } from "../tools/get-chat-info";
import { getMessageHistoryTool } from "../tools/get-message-history";
import { getMessageInfoTool } from "../tools/get-message-info";
import { getMessageMentionsTool } from "../tools/get-message-mentions";
import { searchMessagesTool } from "../tools/search-messages";
import { transcribeVoiceTool } from "../tools/transcribe-voice";
import { Agent } from "./agent";

const CHAT_INFO_AGENT_PROMPT = `You are the CHAT INFO AGENT, specialized in gathering information from chat messages.

Your tools:
- search_messages: Find messages by text (AND logic, not OR)
- get_message_history: Get recent messages in sequence
- get_message_info: Detailed info about specific message
- get_message_mentions: Find replies to/from a message
- get_chat_info: Chat metadata and participants
- transcribe_voice: Convert voice messages to text (OpenAI Whisper)

Critical knowledge:
- search_messages uses AND logic: "create generate" finds messages with BOTH words
- For alternative terms, make MULTIPLE searches
- Message IDs are integers
- "this message" context usually refers to replied-to message

Voice transcription:
- Requires message_id with voice message
- Returns text transcription
- Use when user references voice content

Guidelines:
- Be proactive: search history before asking for IDs
- When user says "that message about X", search for X
- Cross-reference mentions to build conversation threads
- Provide message links when relevant
- For voice: transcribe THEN analyze content

Response style:
- Concise message summaries
- Focus on content, not meta-info unless asked
- Use message IDs for clarity
- Direct and informative`;

export class ChatInfoAgent extends Agent {
  readonly definition = {
    name: "chat_info_agent",
    description:
      "Chat information gathering agent. Use for searching messages, getting message history, retrieving chat info, and transcribing voice messages.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The task for the chat info agent to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "chat_info_agent",
      "claude-sonnet-4-20250514",
      CHAT_INFO_AGENT_PROMPT,
      [
        searchMessagesTool,
        getMessageMentionsTool,
        getMessageHistoryTool,
        getMessageInfoTool,
        getChatInfoTool,
        transcribeVoiceTool,
      ],
      2048,
      1024,
    );
  }
}
