import { delay } from "@elumixor/frontils";
import { useFinishRender } from "io/output";
import type { Job, JobState } from "jobs/job";
import { createContext, type ReactNode, useContext, useState } from "react";

export interface JobContextValue extends Job {
  state: JobState;
}

const JobContext = createContext<JobContextValue | null>(null);

export function JobProvider({ job, children }: { job: Job; children: ReactNode }) {
  const finishRender = useFinishRender();

  const [state, setState] = useState<JobState>("running");

  const value: JobContextValue = {
    ...job,
    addFile: job.addFile.bind(job),
    get currentChatId() {
      return job.currentChatId;
    },
    get userId() {
      return job.userId;
    },
    get state() {
      return state;
    },
    set state(value) {
      setState(value);

      if (value === "done")
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
