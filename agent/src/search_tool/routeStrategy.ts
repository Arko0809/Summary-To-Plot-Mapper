import { RunnableLambda } from "@langchain/core/runnables";
import { SearchInputSchema } from "../utils/schemas";

/**
 * Decides whether a query is best handled by the web-search pipeline or the lighter direct-answer path.
 */
export function routeStrategy(q: string): "web" | "direct" {
  const trimedQuery = q.toLowerCase().trim();

  const isLongQuery = trimedQuery.length > 70;

  const recentYearRegex = /\b20(2[4-9]|3[0-9])\b/.test(trimedQuery);

  // this patterns can change based on the tool that u r creating
  // ppt,
  // e-commerce
  const patterns: RegExp[] = [
    // ─── Rankings & comparisons ───────────────────────────────
    /\btop[-\s]*\d+\b/u,
    /\bbest\b/u,
    /\brank(?:ing|ings|ed)?\b/u,
    /\bwhich\s+is\s+better\b/u,
    /\b(?:vs\.?|versus)\b/u,
    /\bcompare|comparison|compared\s+to\b/u,
    /\b(review|reviews|rated|ratings?)\b/u,
    /\brecommend(?:ation|ations|ed)?\b/u,
    /\bpros\s+and\s+cons\b/u,
    /\balternatives?\s+to\b/u,
    /\bsimilar\s+to\b/u,
    /\bwhich\s+(?:one|should|to\s+choose|is\s+the\s+best)\b/u,
    /\bawards?|oscars?|grammys?|emmys?|nobel\b/u,

    // ─── Price / cost / commerce ──────────────────────────────
    /\bprice|prices|pricing|cost|costs|cheapest|cheaper|affordable\b/u,
    /\bunder\s*\d+(?:\s*[kK])?\b/u,
    /\p{Sc}\s*\d+/u,
    /\b\d+\s*(?:usd|inr|eur|gbp|jpy|dollars?|rupees?|euros?|pounds?)\b/iu,
    /\bbuy|purchase|order\s+now|checkout\b/u,
    /\bdeal|deals|discount|offer|offers|coupon|promo(?:\s*code)?|sale\b/u,
    /\bwhere\s+to\s+buy\b/u,
    /\bin\s+stock|out\s+of\s+stock|available\s+(?:now|at)\b/u,
    /\bshipping|delivery|return\s+policy|warranty\b/u,
    /\bsubscription|plan|plans|tier|tiers|free\s+trial\b/u,
    /\bsalary|salaries|compensation|pay\s+scale\b/u,
    /\bnet\s+worth|valuation|market\s+cap\b/u,

    // ─── Time / recency ───────────────────────────────────────
    /\blatest|today|now|current(?:ly)?|right\s+now|at\s+the\s+moment\b/u,
    /\bup[-\s]*to[-\s]*date|as\s+of\b/u,
    /\b(this|last|next)\s+(?:week|month|year|quarter|season)\b/u,
    /\b(?:20[2-9]\d)\b/u, // years 2020-2099
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/iu,
    /\b(yesterday|tomorrow|tonight|this\s+morning|this\s+evening)\b/u,

    // ─── News / events ────────────────────────────────────────
    /\bnews|breaking|trending|headlines?|updates?\b/u,
    /\bwhat(?:'s|\s+is)\s+happening\b/u,
    /\b(released?|launch(?:ed|ing)?|announce(?:d|ment)?|update[ds]?)\b/u,
    /\bchangelog|release\s*notes?|patch\s*notes?\b/u,
    /\bwinner|won|defeated|beat|score|scores|result|results|standings?|fixtures?|schedule\b/u,
    /\b(match|game|tournament|championship|league|world\s+cup|olympics?)\b/u,
    /\b(transfer|trade|signing|contract|injur(?:y|ed|ies))\b/u,
    /\bprotest|election|vote|voting|referendum|coup|war|conflict|attack\b/u,
    /\bearthquake|flood|hurricane|cyclone|wildfire|tsunami|disaster\b/u,
    /\bweather|forecast|temperature|rain|snow|storm\b/u,
    /\b(?:covid|corona|outbreak|epidemic|pandemic|virus)\b/u,

    // ─── Lifecycle / deprecation ──────────────────────────────
    /\bdeprecated|eol|end\s*of\s*life|sunset|retired?|discontinued\b/u,
    /\broadmap\b/u,
    /\blong[-\s]*term\s+support|lts\b/u,
    /\bmigration\s+guide|breaking\s+change\b/u,

    // ─── Compatibility / setup ────────────────────────────────
    /\bworks\s+with|compatible\s+with|support(?:ed)?\s+on|runs?\s+on\b/u,
    /\binstall(?:ation|ing)?|setup|configure|configuration\b/u,
    /\bsystem\s+requirements?|requirements?\b/u,
    /\bhow\s+to\s+(?:install|setup|configure|use|deploy)\b/u,

    // ─── Version / release specifics ──────────────────────────
    /\bv?\d+\.\d+(?:\.\d+)?\b/u, // version numbers
    /\bversion\s*\d+\b/u,
    /\blatest\s+version|current\s+version|stable\s+release\b/u,
    /\b(github|gitlab|npm|pypi|docker|crates?|maven|nuget)\b/u,
    /\brepo(?:sitory)?|pull\s+request|commit\b/u,

    // ─── Security / stability ─────────────────────────────────
    /\b(cve-?\d+|vulnerabilit(?:y|ies)|exploit|patch(?:ed)?|security\s+(?:advisory|bulletin|update))\b/iu,
    /\b(outage|downtime|down\s+right\s+now|status\s+page)\b/u,

    // ─── People / entities facts ──────────────────────────────
    /\bwho\s+is\b/u,
    /\bwho\s+(?:owns?|runs?|leads?|founded?|ceo|president|pm|prime\s+minister)\b/u,
    /\bceo|founder|president|chairman|director\b/u,
    /\b(?:age|born|birthday|died|passed\s+away)\b/u,
    /\bprofile|biography|bio\b/u,
    /\bheadquarters|hq\b/u,

    // ─── Financial / markets ──────────────────────────────────
    /\bstock|stocks|share\s+price|ticker|nasdaq|nyse|bse|nse|sensex|nifty\b/u,
    /\bcrypto|bitcoin|btc|eth(?:ereum)?|token|blockchain\b/u,
    /\bexchange\s+rate|forex|usd\s+to|inr\s+to|convert\s+\w+\s+to\s+\w+\b/u,
    /\binflation|gdp|interest\s+rate|repo\s+rate|federal\s+reserve\b/u,
    /\bipo|merger|acquisition|acquired|funding\s+round|series\s+[a-e]\b/iu,
    /\blayoffs?|hiring|job\s+openings?|vacanc(?:y|ies)\b/u,

    // ─── Stats / data lookups ─────────────────────────────────
    /\bpopulation|gdp|area|capital\s+of|currency\s+of\b/u,
    /\bhow\s+many|how\s+much\b/u,
    /\bstatistics|stats|data\s+for|numbers?\s+for\b/u,
    /\bcensus|survey|report\s+(?:says|shows|finds)\b/u,

    // ─── Media / entertainment ────────────────────────────────
    /\b(?:movie|film|series|show|episode|season|trailer|teaser)\b/u,
    /\bnetflix|prime\s+video|disney\+?|hulu|hbo|spotify|youtube\b/u,
    /\b(box\s+office|imdb|rotten\s+tomatoes|metacritic)\b/u,
    /\bsong|album|track|artist|band\b/u,
    /\bbook|novel|author|bestseller\b/u,

    // ─── Location / local ─────────────────────────────────────
    /\bnear\s+me|nearby|around\s+me|in\s+my\s+area\b/u,
    /\b(opening\s+hours?|open\s+now|closed\s+now)\b/u,
    /\bdirections?\s+to|distance\s+(?:from|to|between)\b/u,
    /\brestaurants?|cafes?|hotels?|flights?|trains?|buses?\b/u,
    /\bzip\s*code|postal\s+code|pin\s*code\b/u,

    // ─── Travel / live logistics ──────────────────────────────
    /\b(flight|train|bus)\s+(?:status|number|schedule|timing)\b/u,
    /\btraffic|route|eta|arrival|departure\b/u,
    /\bbooking|reservation|availability\b/u,

    // ─── Legal / regulatory / official ────────────────────────
    /\b(law|legal|regulation|policy|act|bill|rule|guideline|compliance)\b/u,
    /\b(tax|taxes|irs|gst|vat|filing)\b/u,
    /\bofficial\s+(?:site|statement|announcement|notice)\b/u,
    /\bgovernment|ministry|department\s+of\b/u,

    // ─── Health / medical current ─────────────────────────────
    /\b(fda|who|cdc|nih|vaccine|treatment|drug|medicine|dosage)\b/u,
    /\bsymptoms?\s+of|diagnos(?:is|ed|e)\b/u,

    // ─── Explicit web-search intents ──────────────────────────
    /\bsearch\s+(?:for|the\s+web|online)\b/u,
    /\blook\s+(?:it\s+)?up\b/u,
    /\bgoogle\s+(?:it|for)\b/u,
    /\bfind\s+(?:me|out|the\s+latest)\b/u,
    /\baccording\s+to\b/u,
    /\bsource|sources|cite|citation\b/u,
    /\bhttps?:\/\/|www\.\S+/u, // URLs in the query
  ];

  const isQueryPresentInPatterns = patterns.some((pattern) =>
    pattern.test(trimedQuery),
  );

  if (isLongQuery || recentYearRegex || isQueryPresentInPatterns) {
    return "web";
  } else {
    return "direct";
  }
}

// routerstep
// LCEL
// q -> string, mode : web/direct
// {q, mode}

/**
 * LCEL step that validates input and adds the chosen routing mode before the pipeline branches.
 */
export const routerStep = RunnableLambda.from(
  async (input: { q: string; companyName: string; modelProvider?: "gemini" | "groq" }) => {
    const { q, modelProvider } = SearchInputSchema.parse(input);

    // decide the mode -> web, direct
    const mode = routeStrategy(q);

    return {
      q,
      companyName: input.companyName,
      mode,
      modelProvider: modelProvider ?? input.modelProvider,
    };
  },
);
