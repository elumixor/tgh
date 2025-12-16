import { beforeEach, describe, expect, test } from "bun:test";
import { createMockContext, replaceToolsWithMocks } from "utils/test-utils";
import { ImageAgent } from "./image-agent";

describe("ImageAgent", () => {
  let agent: ImageAgent;
  let mocks: ReturnType<typeof replaceToolsWithMocks>;

  beforeEach(() => {
    agent = new ImageAgent();
    mocks = replaceToolsWithMocks(agent.tools);
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call generate_image for image generation", async () => {
    await agent.processTask("Generate an image of a sunset", createMockContext());

    const generateMock = mocks.get("generate_image");
    expect(generateMock).toBeDefined();
    expect(generateMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== generateMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call edit_image for image editing", async () => {
    await agent.processTask("Edit this image to make it brighter", createMockContext());

    const editMock = mocks.get("edit_image");
    expect(editMock).toBeDefined();
    expect(editMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== editMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call analyze_image for image analysis", async () => {
    await agent.processTask("What's in this image?", createMockContext());

    const analyzeMock = mocks.get("analyze_image");
    expect(analyzeMock).toBeDefined();
    expect(analyzeMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== analyzeMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call generate_3d_from_image for 3D generation", async () => {
    await agent.processTask("Convert this image to a 3D model", createMockContext());

    const generate3DMock = mocks.get("generate_3d_from_image");
    expect(generate3DMock).toBeDefined();
    expect(generate3DMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== generate3DMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });
});
