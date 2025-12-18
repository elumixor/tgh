import { JobStatus } from "app/components/JobStatus";
import { useJob } from "app/providers/JobProvider";
import { Message } from "io/output";
import { useEffect, useState } from "react";

export function MasterAgent() {
  const job = useJob();
  const [count, setCount] = useState(0);
  const max = 2;

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((c) => {
        if (c >= max) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (count >= max) job.done = true;
  }, [count]);

  return (
    <Message repliesTo={job.messageId}>
      <JobStatus />
      <p>{count}</p>
    </Message>
  );
}
