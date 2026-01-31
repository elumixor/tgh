import type { AgentCallData } from "@agents";
import { JobStatus } from "@components/JobStatus";
import { Tool } from "@components/Tool";
import { useEffectAsync, usePromise } from "@hooks";
import { useJob } from "@providers/JobProvider";
import { LinkPreviewProvider } from "@providers/LinkPreviewProvider";
import { Message } from "io/output";
import { useMemo } from "react";
import { masterAgent } from "./mock";

export function Main() {
  const job = useJob();
  const [summarized, onSummarized] = usePromise<string>();

  const agentData = useMemo<AgentCallData>(
    () => ({
      type: "agent",
      name: masterAgent.name,
      input: "Use MathAgent to add 5 and 7",
      reasoning: masterAgent.reasoning,
      output: masterAgent.output,
      log: masterAgent.log,
      call: masterAgent.call,
    }),
    [],
  );

  useEffectAsync(async () => {
    await masterAgent.run("Use MathAgent to add 5 and 7", { job });
    await summarized;
    job.done = true;
  }, []);

  return (
    <LinkPreviewProvider>
      <Message repliesTo={job.messageId}>
        <Tool data={agentData} root onSummarized={onSummarized} />
        <br />
        <JobStatus />
      </Message>
    </LinkPreviewProvider>
  );
}
