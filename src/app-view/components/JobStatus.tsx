import { useLinkPreview } from "@providers";
import { useJob } from "app-view/providers/JobProvider";
import { useEffect } from "react";

export function JobStatus() {
  const job = useJob();
  const { ignoreUrl } = useLinkPreview();
  const link = `https://platform.openai.com/logs/trace?trace_id=trace_${job.id}`;

  useEffect(() => {
    ignoreUrl(link);
  }, [link]);

  const duration = job.thinkingDuration?.toFixed(2);
  const status = job.state === "done" ? "✅" : job.state === "summarizing" ? `📝 ${duration}s` : "⚡";

  return (
    <p>
      <a href={link}>{status}</a>
    </p>
  );
}
