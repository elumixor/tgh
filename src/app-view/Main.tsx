import { Dots } from "@components/Dots";
import { JobStatus } from "@components/JobStatus";
import { run } from "@openai/agents";
import { useJob } from "@providers/JobProvider";
import { masterAgent } from "agents/master-agent/master-agent";
import { Message } from "io/output";
import { useEffect, useState } from "react";

export function Main() {
  const job = useJob();
  const [result, setResult] = useState<string | null>(null);

  // Run the agent when the component mounts
  useEffect(() => {
    void run(masterAgent, job.messageText, {}).then((value) => {
      setResult(value.finalOutput.response);
      job.done = true;
    });
  }, []);

  return (
    <Message repliesTo={job.messageId}>
      {job.done ? <p>{result}</p> : <Progress toolName={masterAgent.name} />}
      <br />
      <JobStatus />
    </Message>
  );
}

function Progress({ toolName }: { toolName: string }) {
  return (
    <p>
      <u>{toolName}</u>:{" "}
      <i>
        thinking
        <Dots />
      </i>
    </p>
  );
}
