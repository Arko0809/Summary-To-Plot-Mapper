"use client";

import { useMemo, useState } from "react";
import chatbotConfig from "@/config/chatbot-config.json";
import {
  DialogueSetting,
  DialogueSettingSchema,
  formatZodError,
  HumanApprovalAction,
  HumanApprovalActionSchema,
  PlotSubmitSchema,
  SceneDecisionSchema,
  SceneSession,
  SceneSessionSchema,
  SceneSetting,
  SceneSettingSchema,
} from "@/lib/plot-to-scene";

/**
 * UI implementation notes:
 * - This component renders a two-column cinematic form for story input plus a live cutting-room panel.
 * - The palette and surface treatment are taken from the active company config so Netflix and MUBI each feel visually distinct.
 * - The page is built with a form, selection buttons, a status panel, and action buttons that trigger the plot-to-scene API.
 */
const COMPANY_VARIANTS = chatbotConfig as Record<string, { theme: { primary: string; primaryLight: string; primaryDark: string; border: string; panelBackground: string; headerBackground: string; headingText: string; bodyText: string; mutedText: string; brandGradient: string; accentGradient: string; launcherGlow: string; decorativeOne: string; decorativeTwo: string; inputBackground: string; panelBorder: string; chipBackground: string; }; page: { surface: string; surfaceGradient: string; headerBackground: string; background: string; }; }>; 

const SCENE_SETTINGS: { value: SceneSetting; label: string; cue: string }[] = [
  { value: "thriller", label: "Thriller", cue: "Noir tension" },
  { value: "comedy", label: "Comedy", cue: "Screwball wit" },
  { value: "drama", label: "Drama", cue: "Stage hush" },
  { value: "real", label: "Real", cue: "Newsreel grain" },
];

const DIALOGUE_SETTINGS: {
  value: DialogueSetting;
  label: string;
  cue: string;
}[] = [
  { value: "long_monologues", label: "Long monologues", cue: "Spotlight aria" },
  {
    value: "short_conversations",
    label: "Short conversations",
    cue: "Rapid cuts",
  },
];

function cinemaButtonClass(active: boolean) {
  return [
    "rounded-none border-2 px-4 py-3 text-left transition",
    "shadow-[3px_3px_0_0_#3b1d12]",
    active
      ? "border-amber-200 bg-red-800 text-amber-50"
      : "border-amber-900/70 bg-[#1a0c08] text-amber-100 hover:border-amber-400 hover:bg-[#2a140c]",
  ].join(" ");
}

export function PlotToSceneMapper({ company = "mubi" }: { company?: keyof typeof chatbotConfig }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5174";
  const companyTheme = COMPANY_VARIANTS[company]?.theme ?? COMPANY_VARIANTS.mubi.theme;
  const pageTheme = COMPANY_VARIANTS[company]?.page ?? COMPANY_VARIANTS.mubi.page;

  const [plot, setPlot] = useState("");
  const [sceneSetting, setSceneSetting] = useState<SceneSetting | null>(null);
  const [dialogueSetting, setDialogueSetting] =
    useState<DialogueSetting | null>(null);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SceneSession | null>(null);

  const canEditBrief = !session || session.status === "finished";

  const reelTitle = useMemo(() => {
    if (!session) return "Waiting for the first take";
    if (session.status === "finished") return "Picture locked";
    return `Scene ${session.sceneNumber} — awaiting human approval`;
  }, [session]);

  /**
   * Resets the form, scene selections, and session state so the user can start a fresh cinematic draft.
   */
  function handleClear() {
    setPlot("");
    setSceneSetting(null);
    setDialogueSetting(null);
    setFormError("");
    setSession(null);
    setLoading(false);
  }

/**
 * Parses the backend JSON response and enforces the scene-session schema before updating the React state.
 */
  async function parseSessionResponse(response: Response) {
    const data = (await response.json()) as SceneSession | { error?: string };
    if (!response.ok) {
      throw new Error(
        "error" in data && data.error ? data.error : "Request failed",
      );
    }
    return SceneSessionSchema.parse(data);
  }

/**
 * Submits the movie brief and selected shot settings to the backend to start the scene-generation workflow.
 */
  async function handleSubmit() {
    const parsedPlot = PlotSubmitSchema.safeParse({
      plot,
      sceneSetting,
      dialogueSetting,
    });

    if (!parsedPlot.success) {
      const missing: string[] = [];
      const sceneCheck = SceneSettingSchema.safeParse(sceneSetting);
      const dialogueCheck = DialogueSettingSchema.safeParse(dialogueSetting);
      if (!sceneCheck.success) missing.push("Choose a scene setting.");
      if (!dialogueCheck.success) missing.push("Choose a dialogue setting.");
      setFormError(
        missing.length ? missing.join(" ") : formatZodError(parsedPlot.error),
      );
      return;
    }

    setFormError("");
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/plot-to-scene/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedPlot.data),
      });
      setSession(await parseSessionResponse(response));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The studio could not print this scene.",
      );
    } finally {
      setLoading(false);
    }
  }

/**
 * Sends the human decision to the backend and updates the current session with the accepted or rewritten scene.
 */
  async function handleDecision(rawAction: HumanApprovalAction) {
    const parsedAction = HumanApprovalActionSchema.safeParse(rawAction);
    if (!parsedAction.success) {
      setFormError(formatZodError(parsedAction.error));
      return;
    }

    const parsedDecision = SceneDecisionSchema.safeParse({
      threadId: session?.threadId,
      action: parsedAction.data,
    });

    if (!parsedDecision.success) {
      setFormError(formatZodError(parsedDecision.error));
      return;
    }

    setFormError("");
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/plot-to-scene/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedDecision.data),
      });
      setSession(await parseSessionResponse(response));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Approval could not reach the cutting room.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="relative m-4 overflow-hidden border-[6px] border-double text-amber-50 shadow-[0_25px_80px_rgba(0,0,0,0.55)] md:m-8 lg:m-16"
      style={{
        background: pageTheme.surface,
        borderColor: companyTheme.panelBorder,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            company === "mubi"
              ? "repeating-linear-gradient(90deg,transparent_0_18px,rgba(0,36,162,0.08)_18px_22px)"
              : "repeating-linear-gradient(90deg,transparent_0_18px,#1b0d08_18px_22px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: pageTheme.surfaceGradient,
        }}
      />

      <div className="relative">
        <div
          className="flex items-center justify-between gap-3 border-b-4 px-4 py-3 sm:px-6"
          style={{
            background: companyTheme.headerBackground,
            borderColor: companyTheme.panelBorder,
          }}
        >
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              key={index}
              className="h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_10px_#fde68a] max-sm:h-2 max-sm:w-2"
            />
          ))}
        </div>

        <div className="px-5 py-8 sm:px-8">
          <p
            className="font-(family-name:--font-cinema-body) text-[11px] uppercase tracking-[0.45em]"
            style={{ color: companyTheme.primary }}
          >
            Feature presentation · Plot to Scene Mapper
          </p>
          <h2
            className="mt-2 font-(family-name:--font-cinema-display) text-4xl tracking-wide sm:text-5xl"
            style={{ color: companyTheme.headingText }}
          >
            From Plot to Silver Screen
          </h2>
          <p
            className="mt-3 max-w-2xl font-(family-name:--font-cinema-body) text-sm leading-6"
            style={{ color: companyTheme.bodyText }}
          >
            Submit a movie plot, pick the house style, and let the human-approval
            agent create one DOP-ready storyboard beat at a time. Accept continues the reel.
            Rewrite scraps the latest take. Finish locks the picture.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <label className="block">
                <span
                  className="font-(family-name:--font-cinema-display) text-lg"
                  style={{ color: companyTheme.headingText }}
                >
                  Screenplay brief
                </span>
                <textarea
                  value={plot}
                  onChange={(event) => setPlot(event.target.value)}
                  disabled={!canEditBrief || loading}
                  rows={10}
                  placeholder="Type the full plot or summary. Describe characters, the turn, and the ending you want the scenes to chase..."
                  className="mt-3 min-h-48 w-full resize-y rounded-none border-2 p-4 font-(family-name:--font-cinema-body) text-base leading-7 shadow-inner outline-none focus:border-amber-400 disabled:opacity-70"
                  style={{
                    background: companyTheme.inputBackground,
                    borderColor: companyTheme.panelBorder,
                    color: companyTheme.bodyText,
                  }}
                />
              </label>

              <fieldset>
                <legend
                  className="font-(family-name:--font-cinema-display) text-lg"
                  style={{ color: companyTheme.headingText }}
                >
                  Scene setting
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {SCENE_SETTINGS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEditBrief || loading}
                      onClick={() => {
                        const parsed = SceneSettingSchema.safeParse(option.value);
                        if (!parsed.success) {
                          setFormError(formatZodError(parsed.error));
                          return;
                        }
                        setSceneSetting(parsed.data);
                        setFormError("");
                      }}
                      className={cinemaButtonClass(sceneSetting === option.value)}
                    >
                      <span className="block font-(family-name:--font-cinema-display) text-lg">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.25em] opacity-70">
                        {option.cue}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend
                  className="font-[family-name:var(--font-cinema-display)] text-lg"
                  style={{ color: companyTheme.headingText }}
                >
                  Dialogue setting
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {DIALOGUE_SETTINGS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEditBrief || loading}
                      onClick={() => {
                        const parsed = DialogueSettingSchema.safeParse(
                          option.value,
                        );
                        if (!parsed.success) {
                          setFormError(formatZodError(parsed.error));
                          return;
                        }
                        setDialogueSetting(parsed.data);
                        setFormError("");
                      }}
                      className={cinemaButtonClass(
                        dialogueSetting === option.value,
                      )}
                    >
                      <span className="block font-[family-name:var(--font-cinema-display)] text-lg">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.25em] opacity-70">
                        {option.cue}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={loading || !canEditBrief}
                  onClick={handleSubmit}
                  className="border-2 px-6 py-3 font-[family-name:var(--font-cinema-display)] text-lg tracking-wide shadow-[4px_4px_0_0_#fde68a] transition hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                  style={{
                    background: companyTheme.brandGradient,
                    borderColor: companyTheme.primaryLight,
                    color: "#fff",
                  }}
                >
                  {loading && canEditBrief ? "Printing scene…" : "Submit"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleClear}
                  className="border-2 bg-transparent px-6 py-3 font-[family-name:var(--font-cinema-display)] text-lg tracking-wide hover:bg-amber-950 disabled:opacity-50"
                  style={{
                    borderColor: companyTheme.panelBorder,
                    color: companyTheme.headingText,
                  }}
                >
                  Clear
                </button>
              </div>

              {formError ? (
                <p className="border-2 border-red-400 bg-red-950/70 px-4 py-3 font-[family-name:var(--font-cinema-body)] text-sm text-red-100">
                  {formError}
                </p>
              ) : null}
            </div>

            <div
              className="border-2 p-5 shadow-inner"
              style={{
                background: companyTheme.headerBackground,
                borderColor: companyTheme.panelBorder,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.4em]"
                style={{ color: companyTheme.primary }}
              >
                Cutting room
              </p>
              <h3
                className="mt-2 font-[family-name:var(--font-cinema-display)] text-2xl"
                style={{ color: companyTheme.headingText }}
              >
                {reelTitle}
              </h3>

              {session?.acceptedScenes.length ? (
                <ol className="mt-5 space-y-3">
                  {session.acceptedScenes.map((scene, index) => (
                    <li
                      key={`${index}-${scene.slice(0, 12)}`}
                      className="border border-amber-900/80 bg-[#1b100c] px-4 py-3"
                    >
                      <p className="text-[10px] uppercase tracking-[0.3em] text-amber-500">
                        Scene {index + 1} · locked
                      </p>
                      <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-cinema-body)] text-sm leading-6 text-amber-100/90">
                        {scene}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-5 font-[family-name:var(--font-cinema-body)] text-sm text-red-500">
                  Locked scenes will collect here, one take at a time.
                </p>
              )}

              {session && session.status === "awaiting_approval" ? (
                <div className="mt-6 border-2 border-dashed border-amber-500/70 bg-[#2a160f] p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">
                    Latest storyboard · Scene {session.sceneNumber}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap font-[family-name:var(--font-cinema-body)] text-base leading-7 text-red-500">
                    {loading ? "The projector is still spinning…" : session.currentScene}
                  </p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDecision("accept")}
                      className="border-2 border-emerald-300 bg-emerald-900 py-2 font-[family-name:var(--font-cinema-display)] text-emerald-50 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDecision("rewrite")}
                      className="border-2 border-amber-300 bg-amber-900 py-2 font-[family-name:var(--font-cinema-display)] text-amber-50 disabled:opacity-50"
                    >
                      Rewrite
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleDecision("finish")}
                      className="border-2 border-red-300 bg-red-950 py-2 font-[family-name:var(--font-cinema-display)] text-red-50 disabled:opacity-50"
                    >
                      Finish
                    </button>
                  </div>
                </div>
              ) : null}

              {session?.status === "finished" ? (
                <p className="mt-6 border border-amber-600 px-4 py-3 font-[family-name:var(--font-cinema-body)] text-sm text-red-500">
                  The reel is complete. Hit Clear to start a new picture.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
