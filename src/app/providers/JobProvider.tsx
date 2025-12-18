import { delay } from "@elumixor/frontils";
import { useFinishRender } from "io/output";
import { logger } from "logger";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { Job } from "services/job-queue/job";

export interface JobContextValue {
  readonly id: string;
  readonly message: string;
  readonly messageId: number;
  readonly chatId: number;
  readonly link: string;
  done: boolean;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ job, children }: { job: Job; children: ReactNode }) {
  const [done, setDone] = useState(false);
  const finishRender = useFinishRender();

  const value: JobContextValue = {
    id: job.id,
    message: job.userMessage,
    messageId: job.messageId,
    chatId: job.chatId,
    link: job.link,
    get done() {
      return done;
    },
    set done(value) {
      if (value && done) {
        logger.warn({ jobId: job.id }, "Job already completed, ignoring duplicate completion");
        return;
      }

      setDone(value);

      if (value)
        // Delay finishing so that the UI can react to done state first
        void delay(0).then(finishRender);
    },
  };

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJob(): JobContextValue {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error("useJob must be used within a JobProvider");
  return ctx;
}
