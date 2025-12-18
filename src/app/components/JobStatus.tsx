import { useJob } from "app/providers/JobProvider";

export function JobStatus() {
  const job = useJob();
  return (
    <p>
      <a href={job.link}>{job.done ? "Done" : "Processing..."}</a>
    </p>
  );
}
