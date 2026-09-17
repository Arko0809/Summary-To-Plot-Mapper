// answer, sources
// final polish

import { RunnableLambda } from "@langchain/core/runnables";
import { candidate } from "./types";
import { SearchAnswerSchema } from "../utils/schemas";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Validates the search result against the UI contract and repairs malformed output with a focused follow-up model call.
 */
export const finalValidateAndPolish = RunnableLambda.from(
  async (candidate: candidate) => {
    const finalDraft = {
      answer: candidate.answer,
      sources: candidate.sources ?? [],
    };

    const parsed1 = SearchAnswerSchema.safeParse(finalDraft);
    if (parsed1.success) return parsed1.data;

    // one shot repair (extra check)
    const repaired = await repairSearchAns(finalDraft);
    const parsed2 = SearchAnswerSchema.safeParse(repaired);
    if (parsed2.success) return parsed2.data;
  }
);

/**
 * Repairs an invalid answer object by asking the model to return data that matches the expected schema exactly.
 */
async function repairSearchAns(
  obj: any
): Promise<{ answer: string; sources: string[] }> {
  const model = getChatModel({ temperature: 0.2 });

  const response = await model.invoke([
    new SystemMessage(
      [
        "You fix json objects to match a given schema",
        "Respond only with valid json object",
        "Schema: {answer: string; sources: string[] }",
      ].join("\n")
    ),
    new HumanMessage(
      [
        "Make this exactly to the schema. Ensure sources is an array of strings",
        "Input JSON:",
        JSON.stringify(obj),
      ].join("\n\n")
    ),
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : String(response.content);

  const json = extractJson(text);

  return {
    answer: String(json?.answer ?? "").trim(),
    sources: Array.isArray(json?.sources) ? json?.sources?.map(String) : [],
  };
}

/**
 * Extracts the first JSON object from model output so the pipeline can recover from markdown-wrapped payloads.
 */
function extractJson(input: string) {
  const start = input.indexOf("{");
  const end = input.indexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};

  try {
    return JSON.parse(input.slice(start, end + 1));
  } catch {
    return {};
  }
}
