import type { CallData } from "@agents";
import { useArray, useEffectAsync } from "@hooks";
import { useEffect, useState } from "react";
import { summarizer } from "services/summarizer";
import { Line } from "./Line";
import { Output } from "./Output";
import { Reasoning } from "./Reasoning";
import { type Step, Steps } from "./Steps";
import { ToolHeader } from "./ToolHeader";

interface ToolProps {
  data: CallData;
  root?: boolean;
  depth?: number;
  isLast?: boolean;
  onSummarized?: (summary: string) => void;
}

export function Tool({ data, root = false, depth = 0, isLast = true, onSummarized }: ToolProps) {
  const indent = "   ".repeat(depth);
  const parentIndent = depth > 0 ? "   ".repeat(depth - 1) : "";
  const [summary, setSummary] = useState<string>();
  const [reasoning, setReasoning] = useState<string>();
  const [isReasoning, setIsReasoning] = useState(false);
  const [reasoningDuration, setReasoningDuration] = useState<number>();
  const [output, setOutput] = useState<string>();
  const [outputEnded, setOutputEnded] = useState(false);
  const steps = useArray<Step>();
  const [nestedDone, setNestedDone] = useState<Set<string>>(new Set());

  const hasOutput = !!output;
  const hasSteps = steps.length > 0;

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
    if (data.outputEnded) {
      setOutputEnded(true);
      if (data.type === "tool" && data.outputValue) setOutput(data.outputValue);
    }

    const logSub = data.log.subscribe((msg) => steps.push({ type: "log", message: msg }));
    const outputDeltaSub = data.output.delta.subscribe((text) => setOutput((prev) => (prev ?? "") + text));
    const outputEndedSub = data.output.ended.subscribe(() => setOutputEnded(true));

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
          setReasoningDuration(duration);
          setIsReasoning(false);
        }),
        data.call.subscribe((nested) => steps.push({ type: "call", data: nested })),
      );
    }

    return () => {
      for (const sub of subs) sub.unsubscribe();
    };
  }, [data]);

  const nestedCalls = steps.items.filter((s) => s.type === "call");
  const allNestedDone = nestedCalls.every((c) => nestedDone.has(c.data.name));

  useEffectAsync(async () => {
    if (!outputEnded || !allNestedDone || summary) return;
    if (root) {
      onSummarized?.(output ?? "");
    } else {
      const s = await summarizer.summarizeTool(name, inputStr, output ?? "");
      setSummary(s);
      onSummarized?.(s);
    }
  }, [root, outputEnded, allNestedDone, summary]);

  const reasoningPrefix = `${indent}${reasoningIsLast ? "└" : "├"} `;
  const stepPrefix = (index: number) => `${indent}${getStepPrefix(index)} `;
  const outputPrefix = root ? "" : `${indent}└ `;
  const summaryPrefix = `${parentIndent}${headerPrefix} `;

  if (!root && summary)
    return (
      <Line>
        {summaryPrefix}
        {name}: <i>{summary}</i>
      </Line>
    );

  return (
    <>
      <ToolHeader name={name} input={inputStr} prefix={summaryPrefix} root={root} />
      <Reasoning
        prefix={reasoningPrefix}
        reasoning={reasoning}
        isReasoning={isReasoning}
        durationSec={reasoningDuration}
      />
      <Steps
        steps={steps.items}
        depth={depth}
        root={root}
        hasOutput={hasOutput}
        getPrefix={stepPrefix}
        onNestedSummarized={(name) => setNestedDone((prev) => new Set(prev).add(name))}
      />
      {output && <Output output={output} prefix={outputPrefix} root={root} />}
    </>
  );
}
