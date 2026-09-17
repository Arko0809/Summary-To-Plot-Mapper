import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "../shared/models";
import { SummarizeInputSchema, SummarizeOutputSchema } from "./schemas";

/**
 * Summarizes a long page or document into a concise, beginner-friendly version for the user-facing answer.
 */
export async function summarize(text: string) {
  const { text: raw } = SummarizeInputSchema.parse({ text });

  const clipped = clip(raw, 4000);

  const model = getChatModel({ temperature: 0.2 });

  // ask the model to summarize in a controlled manner
  const res = await model.invoke([
    new SystemMessage(
      [
        "You are a helpful assistant that writes short, accurate summaries.",
        "Guidelines:",
        "- Be factual and neutral, aviod marketing language.",
        "- 5-8 sentences; no lists unless absolutely necessary.",
        "- Do NOT invent sources; you only summarize the provided text.",
        "- Keep it readable for beginners",
      ].join("\n")
    ),

    new HumanMessage(
      [
        "Summarize the following content for a beginner friendly audience.",
        "Focus on key facts and remove fluff",
        "TEXT:",
        clipped,
      ].join("\n\n")
    ),
  ]);

  const rawModelOutput =
    typeof res.content === "string" ? res.content : String(res.content);

  const summary = normalizeSummary(rawModelOutput);

  return SummarizeOutputSchema.parse({ summary });
}

/**
 * Trims long input before the model call so the request stays within safe token limits.
 */
function clip(s: string, max: number) {
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Normalizes the model output into a clean summary string before validation and return.
 */
function normalizeSummary(s: string) {
  const t = s
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t.slice(0, 2500);
}
