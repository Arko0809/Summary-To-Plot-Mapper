// cheap mode
// call tavily, fetch, summarize - dont

import { RunnableLambda } from "@langchain/core/runnables";
import { candidate } from "./types";
import { getChatModel } from "../shared/models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ask the model
// get a short helpful ans

/**
 * Fast answer path that responds directly from the model without hitting the web for a short, low-risk query.
 */
export const directPath = RunnableLambda.from(
  async (input: { q: string; mode: "web" | "direct"; modelProvider?: "gemini" | "groq" }): Promise<candidate> => {
    const model = getChatModel({
      temperature: 0.2,
      provider: input.modelProvider ?? "gemini",
    });

    const res = await model.invoke([
      new SystemMessage(
        [
          "You answer briefly and clearly for beginners",
          "If unsure, say so",
        ].join("\n")
      ),
      new HumanMessage(input.q),
    ]);

    const directAns = (
      typeof res.content === "string" ? res.content : String(res.content)
    ).trim();

    return {
      answer: directAns,
      sources: [],
      mode: "direct",
    };
  }
);
