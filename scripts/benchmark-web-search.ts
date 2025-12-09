#!/usr/bin/env bun
import { MasterAgent } from "../src/agents/master-agent/master-agent";
import { InformationAgent } from "../src/agents/information-agent/information-agent";
import { replaceToolsWithMocks } from "../src/utils/test-utils";

const RUNS = 3;
const TEST_QUERY = "What movies are shown this week in Paris?";

console.log("🔥 Web Search Performance Comparison");
console.log(`Query: "${TEST_QUERY}"`);
console.log(`Runs: ${RUNS}\n`);

// Test Master Agent (direct web_search)
const masterAgent = new MasterAgent();
replaceToolsWithMocks(masterAgent.tools);

const masterTimes: number[] = [];
console.log("🤖 Testing Master Agent (direct web_search)...");

for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  const result = await masterAgent.processTask(TEST_QUERY);
  const elapsed = performance.now() - start;
  masterTimes.push(elapsed);
  console.log(`  Run ${i + 1}: ${elapsed.toFixed(0)}ms - Tools: ${result.toolsUsed.join(", ")}`);
}

const masterAvg = masterTimes.reduce((a, b) => a + b, 0) / masterTimes.length;
console.log(`  Average: ${masterAvg.toFixed(0)}ms\n`);

// Test Information Agent (nested approach)
const infoAgent = new InformationAgent();
replaceToolsWithMocks(infoAgent.tools);

const infoTimes: number[] = [];
console.log("🤖 Testing Information Agent (nested approach)...");

for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  const result = await infoAgent.processTask(TEST_QUERY);
  const elapsed = performance.now() - start;
  infoTimes.push(elapsed);
  console.log(`  Run ${i + 1}: ${elapsed.toFixed(0)}ms - Tools: ${result.toolsUsed.join(", ")}`);
}

const infoAvg = infoTimes.reduce((a, b) => a + b, 0) / infoTimes.length;
console.log(`  Average: ${infoAvg.toFixed(0)}ms\n`);

// Results
console.log("📊 Results:");
console.log(`  Master Agent (direct): ${masterAvg.toFixed(0)}ms`);
console.log(`  Information Agent (nested): ${infoAvg.toFixed(0)}ms`);

const improvement = infoAvg - masterAvg;
const improvementPct = ((improvement / infoAvg) * 100).toFixed(1);
console.log(`\n  Improvement: -${improvement.toFixed(0)}ms (-${improvementPct}%)`);
