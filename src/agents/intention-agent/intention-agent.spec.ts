import { beforeEach, describe, expect, test } from "bun:test";
import { replaceToolsWithMocks } from "utils/test-utils";
import { IntentionAgent } from "./intention-agent";

describe("IntentionAgent", () => {
  let agent: IntentionAgent;
  let mocks: ReturnType<typeof replaceToolsWithMocks>;

  beforeEach(() => {
    agent = new IntentionAgent();
    mocks = replaceToolsWithMocks(agent.tools);
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call search_messages for searching", async () => {
    await agent.processTask("Find recent messages mentioning 'test'");

    const searchMock = mocks.get("search_messages");
    expect(searchMock).toBeDefined();
    expect(searchMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== searchMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call get_chat_history for history", async () => {
    await agent.processTask("Get the last 10 messages");

    const historyMock = mocks.get("get_chat_history");
    expect(historyMock).toBeDefined();
    expect(historyMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== historyMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call get_chat_info for chat information", async () => {
    await agent.processTask("Get information about this chat");

    const chatInfoMock = mocks.get("get_chat_info");
    expect(chatInfoMock).toBeDefined();
    expect(chatInfoMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== chatInfoMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call get_message_info for specific message", async () => {
    await agent.processTask("Get details about message 123");

    const messageInfoMock = mocks.get("get_message_info");
    expect(messageInfoMock).toBeDefined();
    expect(messageInfoMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== messageInfoMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });
});
