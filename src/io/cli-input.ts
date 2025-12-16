import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { logger } from "logger";
import { Input } from "./input";

const historyFile = path.join(process.cwd(), ".cli_history");

export class CLIInput extends Input {
  private rl?: readline.Interface;
  private running = false;

  /**
   * Start interactive mode - listens for messages until stopped
   */
  async startInteractive(): Promise<void> {
    if (this.running) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history: this.loadHistory(),
    });

    this.running = true;

    console.log("CLI Bot Started. Type your message and press Enter. Ctrl+C to quit.");
    console.log("Use ↑/↓ arrows to navigate history.\n");

    process.on("SIGINT", () => {
      console.log("\n\nGoodbye!");
      this.stop();
      process.exit(0);
    });

    while (this.running && this.rl) {
      try {
        const message = (await this.rl.question("> ")).trim();

        if (!message) continue;

        if (message.toLowerCase() === "exit") {
          console.log("\nGoodbye!");
          this.stop();
          process.exit(0);
        }

        console.log(""); // Empty line before output
        this.emit({ text: message });
        this.saveHistory();
      } catch {
        // readline closed
        break;
      }
    }
  }

  /**
   * Emit a single message (for non-interactive mode)
   */
  emitSingle(text: string): void {
    this.emit({ text });
  }

  /**
   * Stop interactive mode
   */
  stop(): void {
    this.running = false;
    if (this.rl) {
      this.saveHistory();
      this.rl.close();
      this.rl = undefined;
    }
  }

  private loadHistory(): string[] {
    try {
      if (fs.existsSync(historyFile)) {
        const content = fs.readFileSync(historyFile, "utf-8");
        return content.split("\n").filter((line) => line.trim());
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to load history");
    }
    return [];
  }

  private saveHistory(): void {
    if (!this.rl) return;
    try {
      const history = (this.rl as unknown as { history: string[] }).history;
      fs.writeFileSync(historyFile, history.join("\n"), "utf-8");
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to save history");
    }
  }
}
