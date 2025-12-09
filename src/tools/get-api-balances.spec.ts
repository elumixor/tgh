import { describe, expect, it } from "bun:test";
import { getAPIBalancesTool } from "./get-api-balances";

describe("get-api-balances", () => {
  it("should have correct tool definition", () => {
    expect(getAPIBalancesTool.definition.name).toBe("get_api_balances");
    expect(getAPIBalancesTool.definition.input_schema.required).toEqual([]);
  });

  it("should return proper structure", async () => {
    const result = await getAPIBalancesTool.execute({});
    expect(result).toHaveProperty("balances");
    expect(result).toHaveProperty("summary");

    const typedResult = result as { balances: unknown[]; summary: string };
    expect(Array.isArray(typedResult.balances)).toBe(true);
    expect(typedResult.balances.length).toBe(5);
    expect(typeof typedResult.summary).toBe("string");
  });

  it("should include all service names", async () => {
    const result = (await getAPIBalancesTool.execute({})) as {
      balances: Array<{ service: string; status: string }>;
    };
    const serviceNames = result.balances.map((b) => b.service);

    expect(serviceNames).toContain("Meshy");
    expect(serviceNames).toContain("Anthropic (Claude)");
    expect(serviceNames).toContain("Gemini");
    expect(serviceNames).toContain("Perplexity");
    expect(serviceNames).toContain("OpenAI");
  });

  it("should have status for each service", async () => {
    const result = (await getAPIBalancesTool.execute({})) as {
      balances: Array<{ service: string; status: "success" | "error" }>;
    };

    for (const balance of result.balances) {
      expect(balance.status).toMatch(/^(success|error)$/);
    }
  });
});

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("get-api-balances (manual)", () => {
  it("should fetch real API balances and show details", async () => {
    const result = (await getAPIBalancesTool.execute({})) as {
      balances: Array<{
        service: string;
        status: string;
        credits?: number;
        balance?: string;
        usage?: unknown;
        error?: string;
      }>;
      summary: string;
    };

    console.log("\n=== API Balances ===");
    console.log(result.summary);
    console.log("\n=== Detailed Results ===");
    for (const balance of result.balances) {
      console.log(`\n${balance.service}:`);
      console.log(`  Status: ${balance.status}`);
      if (balance.credits !== undefined) console.log(`  Credits: ${balance.credits}`);
      if (balance.balance) console.log(`  Balance: ${balance.balance}`);
      if (balance.usage) console.log(`  Usage: ${JSON.stringify(balance.usage, null, 2)}`);
      if (balance.error) console.log(`  Error: ${balance.error}`);
    }

    expect(Array.isArray(result.balances)).toBe(true);
    expect(result.balances.length).toBe(5);
  }, 30000);
});
