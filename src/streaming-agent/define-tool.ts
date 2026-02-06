import type { Job } from "jobs/job";
import type { z } from "zod";
import type { ToolDefinition } from "./types";

type ValidToolShape<T extends z.ZodRawShape> = {
  [K in keyof T]: T[K] extends z.ZodOptional<z.ZodTypeAny> ? never : T[K] extends z.ZodRecord ? never : T[K];
};

export function defineTool<TShape extends z.ZodRawShape, TReturn = unknown>(
  name: string,
  description: string,
  parameters: z.ZodObject<TShape & ValidToolShape<TShape>>,
  execute: (params: z.infer<z.ZodObject<TShape>>, context: Job) => TReturn | Promise<TReturn>,
): ToolDefinition<z.ZodObject<TShape>, TReturn> {
  return { name, description, parameters, execute };
}
