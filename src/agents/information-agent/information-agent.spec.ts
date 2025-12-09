import { beforeEach, describe, expect, test } from "bun:test";
import { replaceToolsWithMocks } from "utils/test-utils";
import { InformationAgent } from "./information-agent";

describe("InformationAgent", () => {
  let agent: InformationAgent;
  let mocks: ReturnType<typeof replaceToolsWithMocks>;

  beforeEach(() => {
    agent = new InformationAgent();
    mocks = replaceToolsWithMocks(agent.tools);
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call search_gdd for GDD searches", async () => {
    await agent.processTask("Search the GDD for player movement mechanics");

    const searchGDDMock = mocks.get("search_gdd");
    expect(searchGDDMock).toBeDefined();
    expect(searchGDDMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== searchGDDMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call search_memories for memory searches", async () => {
    await agent.processTask("What do we know about user preferences?");

    const searchMemoriesMock = mocks.get("search_memories");
    expect(searchMemoriesMock).toBeDefined();
    expect(searchMemoriesMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== searchMemoriesMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call add_memory for adding memories", async () => {
    await agent.processTask("Remember that the user prefers concise responses");

    const addMemoryMock = mocks.get("add_memory");
    expect(addMemoryMock).toBeDefined();
    expect(addMemoryMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== addMemoryMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call get_gdd_page for specific GDD pages", async () => {
    await agent.processTask("Get the GDD page with ID abc123");

    const getGDDPageMock = mocks.get("get_gdd_page");
    expect(getGDDPageMock).toBeDefined();
    expect(getGDDPageMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== getGDDPageMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call web_search for web queries", async () => {
    await agent.processTask("Search the web for latest Unity tips");

    const webSearchMock = mocks.get("web_search");
    expect(webSearchMock).toBeDefined();
    expect(webSearchMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== webSearchMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });
});
