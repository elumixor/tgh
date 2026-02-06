import { describe, expect, test } from "bun:test";
import { google } from "./index";

describe.skipIf(!process.env.MANUAL)("Google Drive API", () => {
  test("should build tree with maxDepth 2", async () => {
    const result = await google.drive.tree(undefined, 2);

    console.log("\n=== Tree Structure (JSON) ===");
    console.log(JSON.stringify(result, null, 2));

    console.log("\n=== Tree Structure (XML) ===");
    for (const node of result) console.log(node.toXML());
  });

  test("should search files with glob pattern", async () => {
    const files = await google.drive.search("*.png");

    console.log("\n=== Search Results ===");
    console.log(`Found ${files.length} files`);
    for (const file of files.slice(0, 5)) console.log(`- ${file.name}`);

    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  test("should list root folders", async () => {
    const folders = await google.drive.rootFolder();

    console.log("\n=== Root Folders ===");
    for (const folder of folders) console.log(`- ${folder.name} (${folder.id})`);

    expect(folders.length).toBeGreaterThan(0);
  });
});
