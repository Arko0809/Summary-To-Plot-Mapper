import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  isInterrupted,
} from "@langchain/langgraph";
import { getChatModel } from "../shared/models";
import {
  DialogueSettingSchema,
  HumanApprovalAction,
  HumanApprovalActionSchema,
  PlotSubmit,
  PlotSubmitSchema,
  SceneDecisionSchema,
  SceneDraftSchema,
  SceneSession,
  SceneSessionSchema,
  SceneSettingSchema,
} from "../utils/schemas";
import { z } from "zod";

const HumanAction = HumanApprovalActionSchema;

const GraphState = Annotation.Root({
  plot: Annotation<string>(),
  sceneSetting: Annotation<z.infer<typeof SceneSettingSchema>>(),
  dialogueSetting: Annotation<z.infer<typeof DialogueSettingSchema>>(),
  sceneNumber: Annotation<number>(),
  currentScene: Annotation<string>(),
  acceptedScenes: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  rewriteHint: Annotation<string>(),
  status: Annotation<"awaiting_approval" | "finished">(),
});

type GraphStateType = typeof GraphState.State;

/**
 * Normalizes model output into plain text so scene generation works even when the model returns arrays or structured content.
 */
function sceneTextFromModel(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

/**
 * Keeps the scene output concise by trimming it to the short, cinematic format expected by the UI.
 */
function clampToThreeLines(text: string) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return lines.join("\n");
}

/**
 * Generates the next short scene using the selected style and the evolving story context.
 */
async function writeScene(state: GraphStateType) {
  PlotSubmitSchema.parse({
    plot: state.plot,
    sceneSetting: state.sceneSetting,
    dialogueSetting: state.dialogueSetting,
  });

  const model = getChatModel({ temperature: 0.85, maxTokens: 220 });
  const rewriteBlock = state.rewriteHint
    ? [
        "REWRITE the current scene. Do not reuse the previous draft.",
        "Take a clearly different dramatic approach, camera beat, or conversation angle.",
        `Previous draft to replace:\n${state.rewriteHint}`,
      ].join("\n")
    : "Write a brand-new scene that continues the story after any accepted scenes.";

  const acceptedBlock = state.acceptedScenes.length
    ? `Already accepted scenes:\n${state.acceptedScenes
        .map((scene, index) => `Scene ${index + 1}: ${scene}`)
        .join("\n")}`
    : "No scenes have been accepted yet. This is Scene 1.";

  const response = await model.invoke([
    new SystemMessage(
      [
        "You are a classic studio continuity writer for a retro cinema plot-to-scene mapper.",
        "Return only the scene text. No title, no numbering, no markdown.",
        "Hard limit: at most 2-3 short lines / 2-3 sentences.",
        "You may mix a brief visual description with spoken dialogue.",
        "Match the requested scene setting and dialogue setting exactly.",
      ].join("\n"),
    ),
    new HumanMessage(
      [
        `Scene number: ${state.sceneNumber}`,
        `Scene setting: ${state.sceneSetting}`,
        `Dialogue setting: ${state.dialogueSetting}`,
        `Movie plot / summary:\n${state.plot}`,
        acceptedBlock,
        rewriteBlock,
      ].join("\n\n"),
    ),
  ]);

  const raw = sceneTextFromModel(response.content);

  const scene = SceneDraftSchema.parse({
    scene: clampToThreeLines(raw),
  }).scene;

  return {
    currentScene: scene,
    status: "awaiting_approval" as const,
  };
}

/**
 * Pauses the graph so a human can approve, rewrite, or finish the current scene before the story continues.
 */
async function humanApproval(state: GraphStateType) {
  const payload = SceneSessionSchema.omit({ threadId: true }).parse({
    status: "awaiting_approval",
    sceneNumber: state.sceneNumber,
    currentScene: state.currentScene,
    acceptedScenes: state.acceptedScenes,
  });

  const decision = interrupt(payload);
  const action = HumanAction.parse(decision);

  if (action === "rewrite") {
    return {
      rewriteHint: state.currentScene,
      currentScene: "",
      status: "awaiting_approval" as const,
    };
  }

  const acceptedScenes = [...state.acceptedScenes, state.currentScene];

  if (action === "finish") {
    return {
      acceptedScenes,
      rewriteHint: "",
      status: "finished" as const,
    };
  }

  return {
    acceptedScenes,
    sceneNumber: state.sceneNumber + 1,
    rewriteHint: "",
    currentScene: "",
    status: "awaiting_approval" as const,
  };
}

/**
 * Decides whether the scene graph should continue writing or stop after the human decision.
 */
function afterHuman(state: GraphStateType) {
  return state.status === "finished" ? END : "write_scene";
}

const checkpointer = new MemorySaver();

export const plotToSceneGraph = new StateGraph(GraphState)
  .addNode("write_scene", writeScene)
  .addNode("human_approval", humanApproval)
  .addEdge(START, "write_scene")
  .addEdge("write_scene", "human_approval")
  .addConditionalEdges("human_approval", afterHuman, {
    write_scene: "write_scene",
    [END]: END,
  })
  .compile({ checkpointer });

/**
 * Converts the LangGraph state into the serializable session payload that the frontend consumes.
 */
function toSession(
  threadId: string,
  values: Record<string, unknown>,
): SceneSession {
  if (isInterrupted(values)) {
    const interrupted = values[INTERRUPT][0]?.value as
      | Omit<SceneSession, "threadId">
      | undefined;

    if (interrupted) {
      return SceneSessionSchema.parse({ threadId, ...interrupted });
    }
  }

  return SceneSessionSchema.parse({
    threadId,
    status: values.status ?? "finished",
    sceneNumber: values.sceneNumber ?? 1,
    currentScene: values.currentScene ?? "",
    acceptedScenes: values.acceptedScenes ?? [],
  });
}

/**
 * Starts a new plot-to-scene session and returns the first awaiting-approval state so the UI can render a draft.
 */
export async function startPlotToScene(input: PlotSubmit): Promise<SceneSession> {
  const parsed = PlotSubmitSchema.parse(input);
  const threadId = crypto.randomUUID();
  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 120,
  };

  const result = await plotToSceneGraph.invoke(
    {
      plot: parsed.plot,
      sceneSetting: parsed.sceneSetting,
      dialogueSetting: parsed.dialogueSetting,
      sceneNumber: 1,
      currentScene: "",
      acceptedScenes: [],
      rewriteHint: "",
      status: "awaiting_approval",
    },
    config,
  );

  return toSession(threadId, result as Record<string, unknown>);
}

/**
 * Resumes the active scene session with the human decision and returns the next session state.
 */
export async function decidePlotToScene(
  threadId: string,
  action: HumanApprovalAction,
): Promise<SceneSession> {
  const parsed = SceneDecisionSchema.parse({ threadId, action });
  const config = {
    configurable: { thread_id: parsed.threadId },
    recursionLimit: 120,
  };

  const existing = await plotToSceneGraph.getState(config);
  if (!existing.values || Object.keys(existing.values).length === 0) {
    throw new Error("No active scene session found for this thread");
  }

  const result = await plotToSceneGraph.invoke(
    new Command({ resume: parsed.action }),
    config,
  );

  return toSession(parsed.threadId, result as Record<string, unknown>);
}
