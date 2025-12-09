import { describe, expect, test as t } from "bun:test";
import { replaceToolsWithMocks } from "utils/test-utils";
import { MasterAgent } from "./master-agent";

function test(name: string, fn: () => Promise<void>) {
  return t.if(!!process.env.RUN_MANUAL_TESTS)(name, fn);
}

describe.concurrent("MasterAgent", () => {
  test("[MANUAL] should route image tasks to image_agent", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    await masterAgent.processTask("generate an image of a cat", { messageId: 1 });

    const imageMock = mocks.get("image_agent");
    expect(imageMock).toBeDefined();
    expect(imageMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== imageMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test("[MANUAL] should route drive tasks to drive_agent", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    await masterAgent.processTask("list my files on google drive", { messageId: 1 });

    const driveMock = mocks.get("drive_agent");
    expect(driveMock).toBeDefined();
    expect(driveMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== driveMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test("[MANUAL] should route message search to information_agent", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    await masterAgent.processTask("search for messages about 'claude'");

    const infoMock = mocks.get("information_agent");
    expect(infoMock).toBeDefined();
    expect(infoMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== infoMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test("[MANUAL] should route information tasks to information_agent", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    await masterAgent.processTask("What movies are shown this week in Paris?");

    const infoMock = mocks.get("information_agent");
    expect(infoMock).toBeDefined();
    expect(infoMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== infoMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test("[MANUAL] should call get_api_balances for API balance checks", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    await masterAgent.processTask("check API balances");

    const balancesMock = mocks.get("get_api_balances");
    expect(balancesMock).toBeDefined();
    expect(balancesMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== balancesMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test("should return text response when no tools are used", async () => {
    const masterAgent = new MasterAgent();
    const mocks = replaceToolsWithMocks(masterAgent.tools);

    const result = await masterAgent.processTask("hello");
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("result");

    for (const mock of mocks.values()) expect(mock).not.toHaveBeenCalled();
  });
});
