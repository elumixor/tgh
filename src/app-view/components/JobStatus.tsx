import { useLinkPreview } from "@providers";
import { useJob } from "app-view/providers/JobProvider";
import { useEffect } from "react";
import { Dots } from "./Dots";

export function JobStatus() {
  const job = useJob();
  const { ignoreUrl } = useLinkPreview();
  const link = `https://platform.openai.com/logs/trace?trace_id=trace_${job.id}`;

  useEffect(() => {
    ignoreUrl(link);
  }, [link]);

  const status = job.done ? (
    "Done"
  ) : (
    <>
      Running
      <Dots />
    </>
  );

  return (
    <p>
      <a href={link}>{status}</a>
    </p>
  );
}
