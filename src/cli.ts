import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { MasterAgent } from "agents/master-agent/master-agent";
import { ConsoleOutput } from "io";
import { parseArgs } from "utils/argparser";

const masterAgent = new MasterAgent();
const historyFile = path.join(process.cwd(), ".cli_history");

const { verbose: isVerbose, args } = parseArgs();

// Create console output with verbose flag
const consoleOutput = new ConsoleOutput(isVerbose);

const loadHistory = (): string[] => {
  if (fs.existsSync(historyFile)) {
    const content = fs.readFileSync(historyFile, "utf-8");
    return content.split("\n").filter((line) => line.trim());
  }
  return [];
};

const saveHistory = (rl: readline.Interface) => {
  const history = (rl as unknown as { history: string[] }).history;
  fs.writeFileSync(historyFile, history.join("\n"), "utf-8");
};

const processMessage = async (message: string): Promise<void> => {
  console.log(""); // Empty line before output

  const statusMessage = consoleOutput.sendMessage({ text: "" });

  const result = await masterAgent.processTask(message, { statusMessage, verbose: isVerbose });

  console.log(""); // Empty line after output

  if (!result.success) {
    console.error(`Error: ${result.error ?? "Unknown error"}\n`);
    process.exit(1);
  } else if (result.result) {
    console.log(`Bot: ${result.result}\n`);
  }
};

const runInteractive = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: loadHistory(),
  });

  console.log("CLI Bot Started. Type your message and press Enter. Ctrl+C to quit.");
  console.log("Use ↑/↓ arrows to navigate history.\n");

  process.on("SIGINT", () => {
    console.log("\n\nGoodbye!");
    saveHistory(rl);
    rl.close();
    process.exit(0);
  });

  while (true) {
    const message = (await rl.question("> ")).trim();

    if (!message) continue;

    if (message.toLowerCase() === "exit") {
      console.log("\nGoodbye!");
      saveHistory(rl);
      rl.close();
      process.exit(0);
    }

    await processMessage(message);
    saveHistory(rl);
  }
};

const runSingleCommand = async (prompt: string) => {
  await processMessage(prompt);
  process.exit(0);
};

if (args.length > 0) {
  const prompt = args.join(" ");
  runSingleCommand(prompt);
} else {
  runInteractive();
}
