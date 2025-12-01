import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GramJSClient } from "./gramjs-client";

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("GramJSClient (manual)", () => {
  let client: GramJSClient;

  beforeAll(async () => {
    client = new GramJSClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test(
    "should connect successfully",
    async () => {
      expect(client).toBeDefined();
    },
    { timeout: 10000 },
  );

  test(
    "should search for messages with a common keyword",
    async () => {
      const results = await client.searchMessages({
        query: "test",
        limit: 5,
      });

      expect(results).toBeArray();
      console.log(`Found ${results.length} messages for "test"`);

      for (const msg of results) {
        expect(msg.id).toBeNumber();
        expect(msg.text).toBeString();
        expect(msg.date).toBeInstanceOf(Date);
        console.log(`  [${msg.date.toISOString()}] ${msg.text.slice(0, 50)}...`);
      }
    },
    { timeout: 10000 },
  );

  test(
    "should handle empty search results",
    async () => {
      const results = await client.searchMessages({
        query: "xyznonexistentkeywordabc123",
        limit: 5,
      });

      expect(results).toBeArray();
      expect(results.length).toBe(0);
      console.log("Empty search handled correctly");
    },
    { timeout: 10000 },
  );

  test(
    "should respect limit parameter",
    async () => {
      const limit = 3;
      const results = await client.searchMessages({
        query: "the",
        limit,
      });

      expect(results).toBeArray();
      expect(results.length).toBeLessThanOrEqual(limit);
      console.log(`Limited search returned ${results.length} results (limit: ${limit})`);
    },
    { timeout: 10000 },
  );

  test(
    "should search with special characters",
    async () => {
      const results = await client.searchMessages({
        query: "!",
        limit: 5,
      });

      expect(results).toBeArray();
      console.log(`Found ${results.length} messages with "!"`);
    },
    { timeout: 10000 },
  );

  test(
    "should include sender ID when available",
    async () => {
      const results = await client.searchMessages({
        query: "message",
        limit: 5,
      });

      expect(results).toBeArray();

      for (const msg of results) {
        if (msg.senderId) {
          expect(msg.senderId).toBeNumber();
          console.log(`  Message ${msg.id} from sender ${msg.senderId}`);
        }
      }
    },
    { timeout: 10000 },
  );

  test(
    "should handle large limit by capping at 100",
    async () => {
      const results = await client.searchMessages({
        query: "a",
        limit: 200,
      });

      expect(results).toBeArray();
      expect(results.length).toBeLessThanOrEqual(100);
      console.log(`Large limit capped correctly: ${results.length} results`);
    },
    { timeout: 15000 },
  );

  test(
    "should return messages in reverse chronological order",
    async () => {
      const results = await client.searchMessages({
        query: "bot",
        limit: 10,
      });

      expect(results).toBeArray();

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          const prev = results[i - 1];
          const curr = results[i];
          if (prev && curr) expect(prev.date.getTime()).toBeGreaterThanOrEqual(curr.date.getTime());
        }
        console.log("Messages are in reverse chronological order");
      }
    },
    { timeout: 10000 },
  );
});
