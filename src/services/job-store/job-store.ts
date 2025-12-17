import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { logger } from "logger";
import type { StoredJob } from "./types";

export interface JobStoreOptions {
  maxJobs?: number;
}

export class JobStore {
  private readonly maxJobs: number;
  private readonly runningJobs = new Map<string, StoredJob>();

  constructor(
    private readonly directory: string,
    options: JobStoreOptions = {},
  ) {
    this.maxJobs = options.maxJobs ?? 100;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!existsSync(this.directory)) mkdirSync(this.directory, { recursive: true });
  }

  private getFilePath(jobId: string): string {
    return join(this.directory, `${jobId}.json`);
  }

  generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  createJob(id: string, task: string): StoredJob {
    const job: StoredJob = {
      id,
      startedAt: new Date().toISOString(),
      status: "running",
      task,
      blocks: [],
    };
    this.runningJobs.set(id, job);
    this.save(job);
    return job;
  }

  updateJob(job: StoredJob): void {
    this.save(job);
  }

  completeJob(id: string, status: "completed" | "error"): void {
    const job = this.runningJobs.get(id);
    if (!job) return;

    job.status = status;
    job.completedAt = new Date().toISOString();
    job.duration = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();

    this.save(job);
    this.runningJobs.delete(id);
    this.cleanup();
  }

  private save(job: StoredJob): void {
    try {
      Bun.write(this.getFilePath(job.id), JSON.stringify(job, null, 2));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "JobStore: save failed");
    }
  }

  load(id: string): StoredJob | null {
    // Check running jobs first
    const running = this.runningJobs.get(id);
    if (running) return running;

    // Load from file
    const filePath = this.getFilePath(id);
    if (!existsSync(filePath)) return null;

    try {
      const content = Bun.file(filePath).text();
      return JSON.parse(content as unknown as string) as StoredJob;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error, id }, "JobStore: load failed");
      return null;
    }
  }

  async loadAsync(id: string): Promise<StoredJob | null> {
    const running = this.runningJobs.get(id);
    if (running) return running;

    const filePath = this.getFilePath(id);
    if (!existsSync(filePath)) return null;

    try {
      const content = await Bun.file(filePath).text();
      return JSON.parse(content) as StoredJob;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error, id }, "JobStore: load failed");
      return null;
    }
  }

  list(): { id: string; task: string; status: string; startedAt: string }[] {
    const files = readdirSync(this.directory)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const filePath = join(this.directory, f);
        const stat = statSync(filePath);
        return { file: f, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    const jobs: { id: string; task: string; status: string; startedAt: string }[] = [];

    for (const { file } of files) {
      try {
        const id = file.replace(".json", "");
        const fileContent = readFileSync(join(this.directory, file), "utf-8");
        const content = JSON.parse(fileContent) as StoredJob;
        jobs.push({
          id,
          task: content.task,
          status: content.status,
          startedAt: content.startedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    return jobs;
  }

  async listAsync(): Promise<{ id: string; task: string; status: string; startedAt: string }[]> {
    const files = readdirSync(this.directory)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const filePath = join(this.directory, f);
        const stat = statSync(filePath);
        return { file: f, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    const jobs: { id: string; task: string; status: string; startedAt: string }[] = [];

    for (const { file } of files) {
      try {
        const id = file.replace(".json", "");
        const content = (await Bun.file(join(this.directory, file)).json()) as StoredJob;
        jobs.push({
          id,
          task: content.task,
          status: content.status,
          startedAt: content.startedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    return jobs;
  }

  private cleanup(): void {
    try {
      const files = readdirSync(this.directory)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const filePath = join(this.directory, f);
          const stat = statSync(filePath);
          return { file: f, path: filePath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      // Delete files beyond maxJobs
      for (const file of files.slice(this.maxJobs)) {
        try {
          rmSync(file.path);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "JobStore: cleanup failed");
    }
  }
}
