import { z } from "zod";

// legal contract backend -> AI models -> frontend
// save cost ->

export const WebSearchResultSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  snippet: z.string().optional().default(""),
});

export const WebSearchResultsSchema = z.array(WebSearchResultSchema).max(10);

export type WebSearchResult = z.infer<typeof WebSearchResultsSchema>;

export const OpenUrlInputSchema = z.object({
  url: z.url(),
});

export const OpenUrlOutputSchema = z.object({
  url: z.url(),
  content: z.string().min(1),
});

export const SummarizeInputSchema = z.object({
  text: z.string().min(50, "Need a bit more text to summarize"),
});

export const SummarizeOutputSchema = z.object({
  summary: z.string().min(1),
});

export const SearchInputSchema = z.object({
  q: z.string().min(5, "Please ask a specific query"),
  companyName: z.string().trim().min(1, "companyName is required").max(120),
  useKnowledgeBase: z.boolean().default(false),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

export const SearchAnswerSchema = z.object({
  answer: z.string().min(1),
  // Web answers use URLs; KB answers use human-readable PDF chunk citations.
  sources: z.array(z.string().min(1)).default([]),
});

export type SearchAnswer = z.infer<typeof SearchAnswerSchema>;

export const SceneSettingSchema = z.enum(["thriller", "comedy", "drama", "real"]);
export const DialogueSettingSchema = z.enum([
  "long_monologues",
  "short_conversations",
]);
export const HumanApprovalActionSchema = z.enum(["accept", "rewrite", "finish"]);
export type HumanApprovalAction = z.infer<typeof HumanApprovalActionSchema>;

export const PlotSubmitSchema = z.object({
  plot: z
    .string()
    .trim()
    .min(20, "Give a fuller plot or summary (at least 20 characters)")
    .max(100_000, "Plot is too long (maximum 100,000 characters)"),
  sceneSetting: SceneSettingSchema,
  dialogueSetting: DialogueSettingSchema,
});

export type PlotSubmit = z.infer<typeof PlotSubmitSchema>;

export const SceneDecisionSchema = z.object({
  threadId: z.string().uuid("A valid session id is required"),
  action: HumanApprovalActionSchema,
});

export type SceneDecision = z.infer<typeof SceneDecisionSchema>;

export const SceneDraftSchema = z.object({
  scene: z
    .string()
    .trim()
    .min(1, "Scene text is required")
    .max(2_100, "Storyboard must stay within 5-6 production lines"),
});

export const SceneSessionSchema = z.object({
  threadId: z.string().uuid(),
  status: z.enum(["awaiting_approval", "finished"]),
  sceneNumber: z.number().int().min(1),
  currentScene: z.string(),
  acceptedScenes: z.array(z.string()),
});

export type SceneSession = z.infer<typeof SceneSessionSchema>;
