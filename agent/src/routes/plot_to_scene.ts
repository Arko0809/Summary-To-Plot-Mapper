import { Router } from "express";
import { ZodError } from "zod";
import { PlotSubmitSchema, SceneDecisionSchema } from "../utils/schemas";
import {
  decidePlotToScene,
  startPlotToScene,
} from "../plot_to_scene/graph";

/**
 * Converts validation and runtime errors into clean strings for the client-facing API response.
 */
function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  return (error as Error)?.message ?? "unknown error occured";
}

/**
 * API router for starting a scene-generation session and progressing through human approval decisions.
 */
export const plotToSceneRouter = Router();

plotToSceneRouter.post("/start", async (req, res) => {
  try {
    const input = PlotSubmitSchema.parse(req.body);
    const session = await startPlotToScene(input);
    res.status(200).json(session);
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
});

plotToSceneRouter.post("/decide", async (req, res) => {
  try {
    const input = SceneDecisionSchema.parse(req.body);
    const session = await decidePlotToScene(input.threadId, input.action);
    res.status(200).json(session);
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
});
