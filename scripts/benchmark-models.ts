#!/usr/bin/env bun
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { MasterAgent } from "../src/agents/master-agent/master-agent";

const TEST_QUESTION = "What is 2+2?";
const RUNS = 3;

async function benchmarkAnthropic() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const times: number[] = [];

  console.log("\n🤖 Testing Anthropic Claude Haiku (raw)...");

  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();

    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: TEST_QUESTION }],
    });

    const elapsed = performance.now() - start;
    times.push(elapsed);

    const textBlock = message.content.find((b) => b.type === "text");
    const response = textBlock?.type === "text" ? textBlock.text.substring(0, 50) : "N/A";
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(0)}ms - Response: ${response}`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  Average: ${avg.toFixed(0)}ms`);
  return avg;
}

async function benchmarkOpenAI() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const times: number[] = [];

  console.log("\n🤖 Testing OpenAI GPT-4o...");

  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: TEST_QUESTION }],
    });

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(
      `  Run ${i + 1}: ${elapsed.toFixed(0)}ms - Response: ${completion.choices[0]?.message.content?.substring(0, 50) ?? ""}`,
    );
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  Average: ${avg.toFixed(0)}ms`);
  return avg;
}

async function benchmarkMasterAgent() {
  const agent = new MasterAgent();
  const times: number[] = [];

  console.log("\n🤖 Testing Master Agent (Haiku + all tools/agents)...");
  console.log(`   System prompt: ${agent.systemPrompt.length} chars`);
  console.log(`   Tools count: ${agent.tools.length}`);

  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();

    const response = await agent.processTask(TEST_QUESTION);

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(`  Run ${i + 1}: ${elapsed.toFixed(0)}ms - Response: ${response.success ? response.result : "N/A"}`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  Average: ${avg.toFixed(0)}ms`);
  return avg;
}

async function main() {
  console.log("🔥 Model Response Time Benchmark");
  console.log(`Question: "${TEST_QUESTION}"`);
  console.log(`Runs per model: ${RUNS}`);

  const claudeAvg = await benchmarkAnthropic();
  const gptAvg = await benchmarkOpenAI();
  const masterAvg = await benchmarkMasterAgent();

  console.log("\n📊 Results:");
  console.log(`  Claude Haiku (raw): ${claudeAvg.toFixed(0)}ms`);
  console.log(`  GPT-4o: ${gptAvg.toFixed(0)}ms`);
  console.log(`  Master Agent: ${masterAvg.toFixed(0)}ms`);

  const overhead = masterAvg - claudeAvg;
  const overheadPct = ((overhead / claudeAvg) * 100).toFixed(1);
  console.log(`\n  Master Agent overhead: +${overhead.toFixed(0)}ms (+${overheadPct}%)`);

  const diff = Math.abs(claudeAvg - gptAvg);
  const slower = claudeAvg > gptAvg ? "Claude Haiku" : "GPT-4o";
  const pct = ((diff / Math.min(claudeAvg, gptAvg)) * 100).toFixed(1);
  console.log(`  ${slower} vs other: ${pct}% slower (${diff.toFixed(0)}ms difference)`);
}

main().catch(console.error);
