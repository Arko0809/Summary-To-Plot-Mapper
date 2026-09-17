import { convert } from "html-to-text";
import { OpenUrlOutputSchema } from "./schemas";

// fetch each and every page
// the LLM itself can't browse the web
// our code -> act as a browser tool , decide exactly what content is safe and what we want the model
// to show

// we fetch the url , strip all the unnecessary infos, keep exact article like content that we need

/**
 * Fetches a remote web page, strips boilerplate markup, and returns clean text the model can reason over.
 */
export async function openUrl(url: string) {
  // step1
  const normalized = validateUrl(url);

  // step 2 - fetch the page by ourselfs
  // LLM cant browse
  // generic node fetch
  // avoid instant 403 on strict websites

  const res = await fetch(normalized, {
    headers: {
      "User-Agent": "agent-core/1.0 (+course-demo)",
    },
  });

  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`OpenURL failed ${res.status} - ${body.slice(0, 200)}`);
  }

  // step 3
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  // step 4 html -> plain text
  const text = contentType.includes("text/html")
    ? convert(raw, {
        wordwrap: false,
        selectors: [
          {
            selector: "nav",
            format: "skip",
          },
          {
            selector: "header",
            format: "skip",
          },
          {
            selector: "footer",
            format: "skip",
          },
          {
            selector: "script",
            format: "skip",
          },
          {
            selector: "style",
            format: "skip",
          },
        ],
      })
    : raw;

  // step 5
  const cleaned = collapseWhitespace(text);
  const capped = cleaned.slice(0, 8000);

  return OpenUrlOutputSchema.parse({
    url: normalized,
    content: capped,
  });
}

/**
 * Verifies that the incoming URL is a safe HTTP or HTTPS address before making the network request.
 */
function validateUrl(url: string) {
  try {
    const parsed = new URL(url);
    // https:
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("only http/https are supported");
    }

    return parsed.toString();
  } catch {
    throw new Error("Invalid Url");
  }
}

/**
 * Produces a readable fallback body when a fetch response is not JSON, which helps debug noisy API failures.
 */
async function safeText(res: Response) {
  try {
    return await res.json();
  } catch {
    return "<no body>";
  }
}

/**
 * Normalizes whitespace so page text remains readable and compact after HTML-to-text conversion.
 */
function collapseWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
