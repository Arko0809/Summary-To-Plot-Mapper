// search the internet tool
// u give it a natural language query (the user's query)
// it calls tavily under the hood
// it returns a clean array of search hits -> WebSearchResultSchema

import { env } from "../shared/env";
import { WebSearchResultSchema, WebSearchResultsSchema } from "./schemas";

/**
 * Performs a web search using the configured provider and returns normalized search results for downstream ranking.
 */
export async function webSearch(q: string) {
  const query = (q ?? "").trim();
  if (!query) return [];

  return await searchTavilyUtil(query);
}

/**
 * Calls Tavily directly and normalizes the raw API payload into the app's web result schema.
 */
async function searchTavilyUtil(query: string) {
  if (!env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is missing");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_images: false,
    }),
  });

  if (!response.ok) {
    // production lesson

    const text = await safeText(response);
    throw new Error(`Tavily error, ${response.status}- ${text}`);
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  const normalized = results.slice(0, 5).map((r: any) =>
    WebSearchResultSchema.parse({
      title: String(r?.title ?? "").trim() || "Untitled",
      url: String(r?.url ?? "").trim(),
      snippet: String(r?.content ?? "")
        .trim()
        .slice(0, 220),
    })
  );

  return WebSearchResultsSchema.parse(normalized);
}

/**
 * Extracts a readable JSON or plain-text fallback from a failed provider response for debugging support.
 */
async function safeText(res: Response) {
  try {
    return await res.json();
  } catch {
    return "<no body>";
  }
}
