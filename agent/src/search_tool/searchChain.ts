// routerStrategy -> q
// {q, mode -> web | direct}

import { RunnableBranch, RunnableSequence } from "@langchain/core/runnables";
import { webPath } from "./webPipeline";
import { directPath } from "./directPipeline";
import { routerStep } from "./routeStrategy";
import { finalValidateAndPolish } from "./finalValidate";
import { SearchInput } from "../utils/schemas";
import { runKnowledgeBaseSearch } from "../knowledgeBase/service";
import { env } from "../shared/env";

// web -> webPath
// directPath

// final validation
// JSON

// LCEL ->
// A, B , C

const branch = RunnableBranch.from<{ q: string; mode: "web" | "direct" }, any>([
  [(input) => input.mode === "web", webPath],
  directPath,
]);

/**
 * Main LCEL search pipeline that routes to either the web flow or the direct answer flow and then validates output.
 */
export const searchChain = RunnableSequence.from([
  routerStep,
  branch,
  finalValidateAndPolish,
]);

/**
 * Entry point for any search request: it uses the company KB when enabled, otherwise it uses the LCEL search chain.
 */
export async function runSearch(input: SearchInput) {
  const provider = input.modelProvider ?? (env.MODEL_PROVIDER === "openai" ? "gemini" : env.MODEL_PROVIDER);
  const queryInput = { ...input, modelProvider: provider as "gemini" | "groq" };

  if (input.useKnowledgeBase) {
    return runKnowledgeBaseSearch(queryInput);
  }

  return await searchChain.invoke(queryInput);
}
