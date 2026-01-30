import "extensions";
import { JobStatus } from "@components/JobStatus";
import { delay } from "@elumixor/frontils";
import { useArray, usePromise } from "@hooks";
import { useJob } from "@providers/JobProvider";
import { type AgentCallData, type CallData, StreamingAgent, type ToolDefinition } from "agents/streaming-agent";
import { Message } from "io/output";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

// ============ Create agents (same as demo) ============

const addNumbersTool: ToolDefinition = {
  name: "add_numbers",
  description: "Adds two numbers together",
  parameters: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
  execute: ({ a, b }, _context) => ({ sum: a + b }),
};

const mathAgent = new StreamingAgent({
  name: "MathAgent",
  model: "gpt-5-nano",
  instructions: "You are a math helper. Use the add_numbers tool to perform calculations.",
  tools: [addNumbersTool],
  modelSettings: {
    reasoning: { effort: "low", summary: "auto" },
  },
});

const masterAgent = new StreamingAgent({
  name: "MasterAgent",
  model: "gpt-5-nano",
  instructions: "You are a helpful assistant. Delegate math tasks to MathAgent.",
  tools: [mathAgent],
  modelSettings: {
    reasoning: { effort: "low", summary: "auto" },
  },
});

// ============ Main Component ============

export function Main() {
  const job = useJob();
  const [summarized, onSummarized] = usePromise<string>();

  // Create AgentCallData that connects to the real agent
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

  useEffect(() => {
    void (async () => {
      // Run the real agent
      await masterAgent.run("Use MathAgent to add 5 and 7", { job });

      // Wait for UI summarization to complete
      await summarized;
      job.done = true;
    })();
  }, []);

  return (
    <Message repliesTo={job.messageId}>
      <Tool data={agentData} root onSummarized={onSummarized} />
      <br />
      <JobStatus />
    </Message>
  );
}

/** Mock summarization - returns summary after delay */
async function mockSummarize(_name: string, _input: string, _steps: string[], output: string): Promise<string> {
  await delay(1);
  return `${output.slice(0, 30)}...`;
}

// ============ Tool Component ============

interface ToolProps {
  data: CallData;
  root?: boolean;
  depth?: number;
  isLast?: boolean;
  onSummarized?: (summary: string) => void;
}

type Step = { type: "log"; message: string } | { type: "call"; data: CallData };

function Tool({ data, root = false, depth = 0, isLast = true, onSummarized }: ToolProps) {
  const indent = "   ".repeat(depth);
  const parentIndent = depth > 0 ? "   ".repeat(depth - 1) : "";
  const [summary, setSummary] = useState<string>();
  const [reasoning, setReasoning] = useState<string>();
  const [isReasoning, setIsReasoning] = useState(false);
  const [reasoningDurationSec, setReasoningDurationSec] = useState<number>();
  const [output, setOutput] = useState<string>();
  const [outputEnded, setOutputEnded] = useState(false);
  const steps = useArray<Step>();
  const [nestedDone, setNestedDone] = useState<Set<string>>(new Set());

  // Determine what content exists for prefix calculation
  const hasOutput = !!output;
  const hasSteps = steps.length > 0;

  // Prefix helpers
  const reasoningIsLast = !hasSteps && (root || !hasOutput);
  const getStepPrefix = (index: number) => {
    const isLastStep = index === steps.length - 1;
    if (root) return isLastStep ? "└" : "├";
    return isLastStep && !hasOutput ? "└" : "├";
  };
  const headerPrefix = isLast ? "└" : "├";

  const { name, input } = data;
  const inputStr = typeof input === "string" ? input : JSON.stringify(input);

  useEffect(() => {
    // Check if output already ended before we subscribed (race condition fix)
    if (data.outputEnded) {
      setOutputEnded(true);
    }

    // Subscribe to log events
    const logSub = data.log.subscribe((msg) => steps.push({ type: "log", message: msg }));

    // Subscribe to output events
    const outputDeltaSub = data.output.delta.subscribe((text) => setOutput((prev) => (prev ?? "") + text));
    const outputEndedSub = data.output.ended.subscribe(() => setOutputEnded(true));

    // Agent-specific subscriptions
    const subs: { unsubscribe(): void }[] = [logSub, outputDeltaSub, outputEndedSub];

    if (data.type === "agent") {
      let reasoningStartTime: number;
      subs.push(
        data.reasoning.started.subscribe(() => {
          reasoningStartTime = Date.now();
          setIsReasoning(true);
        }),
        data.reasoning.delta.subscribe((text) => setReasoning((prev) => (prev ?? "") + text)),
        data.reasoning.ended.subscribe(() => {
          const duration = Math.round((Date.now() - reasoningStartTime) / 1000);
          setReasoningDurationSec(duration);
          setIsReasoning(false);
        }),
        data.call.subscribe((nested) => steps.push({ type: "call", data: nested })),
      );
    }

    return () => {
      for (const sub of subs) sub.unsubscribe();
    };
  }, [data]);

  // Check if all nested calls are done
  const nestedCalls = steps.filter((s) => s.type === "call");
  const logs = steps.filter((s) => s.type === "log");
  const allNestedDone = nestedCalls.every((c) => nestedDone.has(c.data.name));

  // Trigger summarization when output is done and all nested calls are done
  useEffect(() => {
    if (!outputEnded || !allNestedDone || summary) return;
    if (root) {
      onSummarized?.(output ?? "");
    } else {
      void mockSummarize(
        name,
        inputStr,
        logs.map((l) => l.message),
        output ?? "",
      ).then((s) => {
        setSummary(s);
        onSummarized?.(s);
      });
    }
  }, [root, outputEnded, allNestedDone, summary]);

  // Prefix helpers
  const reasoningPrefix = `${indent}${reasoningIsLast ? "└" : "├"} `;
  const stepPrefix = (index: number) => `${indent}${getStepPrefix(index)} `;
  const outputPrefix = root ? "" : `${indent}└ `;
  const summaryPrefix = `${parentIndent}${headerPrefix} `;

  // Helper for consistent line rendering
  const Line = ({ children }: { children: ReactNode }) => (
    <>
      {children}
      <br />
    </>
  );

  // Once summarized, show only the summary (never for root)
  if (!root && summary)
    return (
      <Line>
        {summaryPrefix}
        {name}: <i>{summary}</i>
      </Line>
    );

  return (
    <>
      <Line>
        {root ? "" : summaryPrefix}
        <b>{name}</b>({inputStr})
      </Line>
      {isReasoning && (
        <Line>
          {reasoningPrefix}
          {reasoning} 💭
        </Line>
      )}
      {!isReasoning && reasoningDurationSec !== undefined && (
        <Line>
          {reasoningPrefix}💭 ({reasoningDurationSec}s)
        </Line>
      )}
      {steps.map((step, index) =>
        step.type === "log" ? (
          <Line key={step.message}>
            {stepPrefix(index)}
            {step.message}
          </Line>
        ) : (
          <Tool
            key={step.data.name}
            depth={depth + 1}
            data={step.data}
            isLast={index === steps.length - 1 && (root || !hasOutput)}
            onSummarized={() => setNestedDone((prev) => new Set(prev).add(step.data.name))}
          />
        ),
      )}
      {output && (
        <>
          {root && <br />}
          <Line>
            {outputPrefix}
            {output}
          </Line>
        </>
      )}
    </>
  );
}
