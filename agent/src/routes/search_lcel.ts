import { Router } from "express";
import { SearchInputSchema } from "../utils/schemas";
import { runSearch } from "../search_tool/searchChain";
import { assertSafeChatQuery, GuardrailViolation } from "../utils/guardrails";

/**
 * API router that accepts a search request and resolves it through the LCEL pipeline or company KB pipeline.
 */
export const searchRouter = Router();

searchRouter.post("/", async (req, res) => {
  try {
    const input = SearchInputSchema.parse(req.body);
    assertSafeChatQuery(input.q);
    const result = await runSearch(input);
    res.status(200).json(result);
  } catch (e) {
    const errorMessage = e instanceof GuardrailViolation
      ? e.message
      : (e as Error)?.message ?? "unknown error occured";
    res.status(400).json({ error: errorMessage });
  }
});
