import { JobStatus, Tool } from "@components";
import { random } from "@elumixor/frontils";
import { useEffectAsync, usePromise } from "@hooks";
import { useJob } from "@providers/JobProvider";
import { LinkPreviewProvider } from "@providers/LinkPreviewProvider";
import { Message } from "io/output";
import { logger } from "logger";
import { masterAgent } from "master-agent";
import { useMemo, useState } from "react";
import { gramjsClient } from "services/telegram";
import type { AgentCallData } from "streaming-agent";

export function Main() {
  const job = useJob();
  const [summarized, onSummarized] = usePromise<string>();
  const [input, setInput] = useState<string>("...");

  const agentData = useMemo<AgentCallData>(
    () => ({
      type: "agent",
      id: random.string(8),
      name: masterAgent.name,
      input,
      reasoning: masterAgent.reasoning,
      output: masterAgent.output,
      log: masterAgent.log,
      call: masterAgent.call,
    }),
    [input],
  );

  useEffectAsync(async () => {
    // Get chat messages from the current chat
    const messages = await gramjsClient.getMessages({
      chatId: job.currentChatId,
      limit: 10,
      order: "oldest first",
    });

    const content = messages.map((msg) => msg.toXml()).join("\n");
    setInput(content);

    try {
      await masterAgent.run(content, job);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Agent run failed");
    }

    job.state = "summarizing";

    try {
      await summarized;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Summarization failed");
    }

    job.state = "done";
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
