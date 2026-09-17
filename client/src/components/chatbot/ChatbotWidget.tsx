
"use client";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import chatbotConfig from "@/config/chatbot-config.json";

type CompanyKey = keyof typeof chatbotConfig;

type SearchResponse = {
  answer: string;
  sources: string[];
};

type Answer = {
  id: number;
  question: string;
  answer: string;
  sources: string[];
  isError?: boolean;
};

type ChatbotWidgetProps = {
  company: CompanyKey;
};

function renderInlineText(text: string): ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) => {
    const boldMatch = part.match(/^\*\*(.*)\*\*$/);

    if (boldMatch) {
      return <strong key={`${part}-${index}`}>{boldMatch[1]}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderStructuredAnswer(answer: string): ReactNode {
  const lines = answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return answer;
  }

  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;

    blocks.push(
      <ul key={`list-${blocks.length}`} className="mt-2 space-y-2 pl-5">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc leading-6 text-inherit">
            {renderInlineText(item)}
          </li>
        ))}
      </ul>,
    );

    listItems = [];
  };

  lines.forEach((line, index) => {
    const sectionMatch = line.match(/^[-*]\s+\*\*(.+?)\*\*:\s*(.+)$/);
    const numberedSectionMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*:\s*(.+)$/);

    if (sectionMatch || numberedSectionMatch) {
      flushList();
      const match = sectionMatch ?? numberedSectionMatch;
      const title = match?.[1] ?? "";
      const content = match?.[2] ?? "";

      blocks.push(
        <div key={`section-${index}`} className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {renderInlineText(title)}
          </div>
          <div className="text-sm leading-6 text-slate-700">
            {renderInlineText(content)}
          </div>
        </div>,
      );
      return;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+|^\d+\.\s+/, ""));
      return;
    }

    if (listItems.length) {
      flushList();
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="mt-2 text-sm leading-6 text-inherit">
        {renderInlineText(line)}
      </p>,
    );
  });

  flushList();

  return <>{blocks}</>;
}

/**
 * UI implementation notes:
 * - The assistant behaves like a floating panel that opens from a launcher button.
 * - Each company preserves its own messaging, brand colors, and spacing tokens from chatbot-config.json.
 * - The layout is composed of a header, message stream, suggestion cards, input area, and an always-visible launcher.
 * - The panel visibility and keyboard behavior are controlled by local React state, while all brand styling is driven by the selected company theme.
 */
export function ChatbotWidget({
  company,
}: ChatbotWidgetProps) {
  const config = chatbotConfig[company];
  const panelRadius = config.widget.panelRadius ?? "28px";
  const launcherRadius = config.widget.launcherRadius ?? "20px";
  const panelShadow = config.widget.shadow ?? "0 30px 80px rgba(0,0,0,.16)";

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [knowledgeBaseMode, setKnowledgeBaseMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:5000";
  const theme = useMemo(() => config.theme, [config]);

  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [answers, loading]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

/**
 * Opens or closes the floating assistant panel without leaving the page layout.
 */
  function toggleChat() {
    setIsOpen((current) => !current);
  }

  /**
   * Submits the current chat question to the backend search endpoint and stores the answer in the transcript.
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanQuery = query.trim();

    if (!cleanQuery || loading) {
      return;
    }

    setQuery("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: cleanQuery,
          companyName: config.company.name,
          useKnowledgeBase: knowledgeBaseMode,
        }),
      });

      const data =
        (await response.json()) as
          | SearchResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Request failed"
        );
      }

      const searchResponse = data as SearchResponse;

      setAnswers((current) => [
        ...current,
        {
          id: Date.now(),
          question: cleanQuery,
          answer: searchResponse.answer,
          sources: Array.isArray(searchResponse.sources)
            ? searchResponse.sources
            : [],
        },
      ]);
    } catch (error) {
      console.error(error);

      setAnswers((current) => [
        ...current,
        {
          id: Date.now(),
          question: cleanQuery,
          answer:
            "I couldn't process that request right now. Please try again.",
          sources: [],
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }

/**
 * Allows the user to submit a question by pressing Enter, while keeping focus inside the input field.
 */
  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    event.currentTarget.form?.requestSubmit();
  }

  const positionClass =
    config.widget.position === "bottom-left"
      ? "left-6 max-sm:left-4"
      : "right-6 max-sm:right-4";

  return (
    <div
      className={`fixed bottom-6 z-[9999] ${positionClass}`}
    >
      {/* ====================================================== */}
      {/* CHAT PANEL                                             */}
      {/* ====================================================== */}

      <div
        className={[
          "absolute bottom-[82px]",
          config.widget.position === "bottom-left"
            ? "left-0 origin-bottom-left"
            : "right-0 origin-bottom-right",

          "w-[390px] max-w-[calc(100vw-32px)]",
          "h-[650px] max-h-[calc(100vh-120px)]",
          "max-sm:h-[calc(100vh-100px)]",

          "flex flex-col overflow-hidden",
          "border border-white/70",

          "transition-all duration-300 ease-out",

          isOpen
            ? "visible translate-y-0 scale-100 opacity-100"
            : "pointer-events-none invisible translate-y-6 scale-90 opacity-0",
        ].join(" ")}
        style={{
          backgroundColor: theme.panelBackground,
          boxShadow: panelShadow,
          borderRadius: panelRadius,
        }}
        aria-hidden={!isOpen}
      >
        {/* ====================================================== */}
        {/* BACKGROUND                                             */}
        {/* ====================================================== */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-20 blur-3xl"
            style={{
              backgroundColor: theme.primary,
            }}
          />

          <div
            className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full opacity-10 blur-3xl"
            style={{
              backgroundColor: theme.primaryDark,
            }}
          />
        </div>

        {/* ====================================================== */}
        {/* HEADER                                                 */}
        {/* ====================================================== */}

        <header
          className="relative z-10 flex items-center gap-3 border-b px-[18px] pb-4 pt-[18px]"
          style={{
            backgroundColor: theme.headerBackground,
            borderColor: `${theme.border}80`,
          }}
        >
          <div className="relative grid h-12 w-12 shrink-0 place-items-center">
            <div
              className="relative z-10 grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-[14px] shadow-lg"
              style={{
                background: theme.brandGradient,
              }}
            >
              <img
                src={config.company.logo}
                alt={`${config.company.name} logo`}
                className="h-full w-full object-contain bg-white p-1"
              />
            </div>

            <div
              className="absolute h-[48px] w-[48px] rounded-[15px] border opacity-30"
              style={{
                borderColor: theme.primary,
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="text-[15px] font-bold"
              style={{
                color: theme.headingText,
              }}
            >
              {config.company.name}
            </div>

            <div
              className="mt-1 flex items-center gap-1.5 text-[11px]"
              style={{
                color: theme.mutedText,
              }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{
                  backgroundColor: theme.success,
                  boxShadow: `0 0 0 4px ${theme.success}18`,
                }}
              />

              {config.content.status}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleChat}
            aria-label="Close chat"
            className="grid h-[34px] w-[34px] place-items-center rounded-full bg-black/[0.04] text-gray-500 transition-all duration-200 hover:rotate-90"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        {/* Brand accent line */}
        <div
          className="relative z-20 h-0.5 w-full"
          style={{
            background: theme.accentGradient,
          }}
        />

        {/* ====================================================== */}
        {/* MESSAGES                                               */}
        {/* ====================================================== */}

        <div
          ref={messagesRef}
          className="relative z-10 flex-1 overflow-y-auto px-4 py-5"
        >
          {answers.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center px-3 text-center">
              <div
                className="mb-5 grid h-20 w-20 place-items-center rounded-[26px]"
                style={{
                  backgroundColor: theme.primaryLight,
                  boxShadow: `0 15px 40px ${theme.primary}25`,
                }}
              >
                <div
                  className="grid h-[52px] w-[52px] place-items-center rounded-[18px] text-white"
                  style={{
                    background: theme.brandGradient,
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.5 8.8 8.8 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 3 10.5 8.5 8.5 0 0 1 11.5 2 8.4 8.4 0 0 1 21 11.5Z" />
                    <path d="M8 10h.01" />
                    <path d="M12 10h.01" />
                    <path d="M16 10h.01" />
                  </svg>
                </div>
              </div>

              <h2
                className="text-2xl font-extrabold tracking-tight"
                style={{
                  color: theme.headingText,
                }}
              >
                {config.content.welcomeTitle}
              </h2>

              <p
                className="mt-2 max-w-[280px] text-[13px] leading-6"
                style={{
                  color: theme.mutedText,
                }}
              >
                {config.content.welcomeDescription}
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {config.content.suggestions.map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        setQuery(suggestion)
                      }
                      className="rounded-full border px-3 py-2 text-[11px] font-semibold transition-transform duration-200 hover:-translate-y-0.5"
                      style={{
                        backgroundColor:
                          theme.primaryLight,
                        borderColor:
                          theme.border,
                        color:
                          theme.primaryDark,
                      }}
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {answers.map((answer) => (
            <div
              key={answer.id}
              className="mb-5 space-y-2.5"
            >
              {/* ================================================== */}
              {/* USER MESSAGE                                      */}
              {/* ================================================== */}

              <div className="flex justify-end">
                <div
                  className="max-w-[82%] rounded-[16px_16px_4px_16px] px-[13px] py-2.5 text-[13px] leading-[1.45] text-white"
                  style={{
                    background: theme.userBubble,
                  }}
                >
                  {answer.question}
                </div>
              </div>

              {/* ================================================== */}
              {/* ASSISTANT MESSAGE                                 */}
              {/* ================================================== */}

              <div className="flex items-start gap-2">
                <div
                  className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-[10px]"
                  style={{
                    backgroundColor:
                      theme.primaryLight,
                  }}
                >
                  <img
                    src={config.company.logo}
                    alt=""
                    className="h-full w-full object-contain bg-white p-1"
                  />
                </div>

                <div className="min-w-0 max-w-[88%]">
                  {/* Answer */}
                  <div
                    className={`rounded-[4px_16px_16px_16px] border px-[13px] py-[11px] text-[13px] leading-[1.6] ${
                      answer.isError
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "bg-white text-black"
                    }`}
                    style={
                      answer.isError
                        ? undefined
                        : {
                            color: theme.bodyText,
                            borderColor:
                              theme.border,
                          }
                    }
                  >
                    {answer.isError ? answer.answer : renderStructuredAnswer(answer.answer)}
                  </div>

                  {/* Sources */}
                  {!answer.isError &&
                    answer.sources.length > 0 && (
                      <div className="mt-2">
                        <div
                          className="mb-1.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            color:
                              theme.mutedText,
                          }}
                        >
                          Sources
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {answer.sources.map(
                            (source, sourceIndex) => (
                              <div
                                key={`${source}-${sourceIndex}`}
                                className="max-w-full rounded-lg border px-2 py-1.5 text-[10px] leading-4"
                                style={{
                                  backgroundColor:
                                    theme.primaryLight,
                                  borderColor:
                                    theme.border,
                                  color:
                                    theme.primaryDark,
                                }}
                                title={source}
                              >
                                <span className="mr-1 opacity-60">
                                  {sourceIndex + 1}.
                                </span>

                                {source}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}

          {/* ====================================================== */}
          {/* LOADING                                               */}
          {/* ====================================================== */}

          {loading && (
            <div className="flex items-start gap-2">
              <div
                className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-[10px]"
                style={{
                  backgroundColor:
                    theme.primaryLight,
                }}
              >
                <img
                  src={config.company.logo}
                  alt=""
                  className="h-full w-full object-contain bg-white p-1"
                />
              </div>

              <div className="flex items-center gap-1 rounded-[4px_16px_16px_16px] border bg-white px-3.5 py-[13px]">
                {[0, 1, 2].map((item) => (
                  <span
                    key={item}
                    className="h-[5px] w-[5px] rounded-full"
                    style={{
                      backgroundColor:
                        theme.primary,
                      animation: `chatbotTyping 1.15s ${item * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ====================================================== */}
        {/* FOOTER                                                 */}
        {/* ====================================================== */}

        <div
          className="relative z-10 border-t px-3.5 pb-3 pt-3"
          style={{
            borderColor: `${theme.border}80`,
            backgroundColor: "#ffffff",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-center gap-2 rounded-2xl border bg-white p-1 pl-3 transition-all"
              style={{
                borderColor: theme.border,
              }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                onKeyDown={handleInputKeyDown}
                disabled={loading}
                placeholder={
                  config.content.inputPlaceholder
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
              />

              <button
                type="button"
                onClick={() => setKnowledgeBaseMode((enabled) => !enabled)}
                aria-pressed={knowledgeBaseMode}
                aria-label="Toggle policy knowledge base mode"
                className="h-[34px] shrink-0 rounded-[10px] border px-2 text-[10px] font-extrabold transition-all hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: knowledgeBaseMode ? theme.brandGradient : theme.primaryLight,
                  borderColor: knowledgeBaseMode ? theme.primary : theme.border,
                  color: knowledgeBaseMode ? "#ffffff" : theme.primaryDark,
                }}
              >
                KB
              </button>

              <button
                type="submit"
                disabled={
                  loading || !query.trim()
                }
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
                style={{
                  background: theme.brandGradient,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </div>
          </form>

          <div
            className="mt-2 flex items-center justify-center gap-1.5 text-[9px] font-semibold"
            style={{
              color: theme.mutedText,
            }}
          >
            <span>{config.content.footerLeft}</span>
            <span>•</span>
            <span>{config.content.footerRight}</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FLOATING LAUNCHER                                       */}
      {/* ======================================================== */}

      <button
        type="button"
        onClick={toggleChat}
        aria-label={
          isOpen ? "Close assistant" : "Open assistant"
        }
        aria-expanded={isOpen}
        className="relative grid h-16 w-16 place-items-center rounded-[22px] bg-transparent transition-transform duration-300 hover:-translate-y-1 active:scale-95 max-sm:h-[58px] max-sm:w-[58px]"
      >
        <span
          className="absolute inset-1 rounded-[22px] blur-xl"
          style={{
            backgroundColor: theme.launcherGlow,
            opacity: 0.35,
          }}
        />

        <span
          className="relative z-10 grid h-[58px] w-[58px] place-items-center border text-white shadow-xl max-sm:h-[54px] max-sm:w-[54px]"
          style={{
            background: theme.launcher,
            borderRadius: launcherRadius,
          }}
        >
          {isOpen ? (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.5 8.8 8.8 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 3 10.5 8.5 8.5 0 0 1 11.5 2 8.4 8.4 0 0 1 21 11.5Z" />
              <path d="M8 10h.01" />
              <path d="M12 10h.01" />
              <path d="M16 10h.01" />
            </svg>
          )}
        </span>

        {!isOpen && (
          <span
            className="absolute right-0 top-0 z-20 h-3.5 w-3.5 rounded-full border-[3px] border-white"
            style={{
              backgroundColor: theme.success,
            }}
          />
        )}
      </button>
    </div>
  );
}

