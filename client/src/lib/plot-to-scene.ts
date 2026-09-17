import { z } from "zod";

export const SceneSettingSchema = z.enum(["thriller", "comedy", "drama", "real"]);
export const DialogueSettingSchema = z.enum([
  "long_monologues",
  "short_conversations",
]);
export const HumanApprovalActionSchema = z.enum([
  "accept",
  "rewrite",
  "finish",
]);

export const PlotSubmitSchema = z.object({
  plot: z
    .string()
    .trim()
    .min(20, "Give a fuller plot or summary (at least 20 characters)")
    .max(8000, "Plot is too long"),
  sceneSetting: SceneSettingSchema,
  dialogueSetting: DialogueSettingSchema,
});

export const SceneDecisionSchema = z.object({
  threadId: z.string().uuid("A valid session id is required"),
  action: HumanApprovalActionSchema,
});

export const SceneSessionSchema = z.object({
  threadId: z.string().uuid(),
  status: z.enum(["awaiting_approval", "finished"]),
  sceneNumber: z.number().int().min(1),
  currentScene: z.string(),
  acceptedScenes: z.array(z.string()),
});

export type SceneSetting = z.infer<typeof SceneSettingSchema>;
export type DialogueSetting = z.infer<typeof DialogueSettingSchema>;
export type HumanApprovalAction = z.infer<typeof HumanApprovalActionSchema>;
export type SceneSession = z.infer<typeof SceneSessionSchema>;

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}
