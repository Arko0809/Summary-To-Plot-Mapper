// 2
// web path -> browse, summarize, source urls/ cite urls
// direct path -> LLM. no browsing
// shared shape -> candidate

export type candidate = {
  answer: string;
  sources: string[]; // []
  mode: "web" | "direct";
};

// explain what docker is
// under 70k -> real browsing
