"use client";

import { useParams } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import chatbotConfig from "@/config/chatbot-config.json";
import { PlotToSceneMapper } from "@/components/plot-to-scene/PlotToSceneMapper";

export default function CompanyPage() {
  const params = useParams<{ company: string }>();
  const company = (params.company ?? "mubi") as keyof typeof chatbotConfig;
  const companyConfig = chatbotConfig[company] ?? chatbotConfig.mubi;
  const pageTheme = companyConfig.page;
  const accentTheme = companyConfig.theme;

  return (
    <main
      className="relative min-h-dvh overflow-hidden text-amber-50"
      style={{
        background: pageTheme.background,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            pageTheme.pattern === "editorial-grid"
              ? "linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)"
              : "repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_4px)",
          backgroundSize:
            pageTheme.pattern === "editorial-grid"
              ? "18px 18px"
              : "auto",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: pageTheme.surfaceGradient,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <header
          className="mb-10 border-y-4 px-4 py-6 text-center"
          style={{
            background: pageTheme.headerBackground,
            borderColor: pageTheme.headerBorder,
            boxShadow: pageTheme.headerShadow,
          }}
        >
          <p
            className="font-(family-name:--font-cinema-body) text-[11px] uppercase tracking-[0.55em]"
            style={{ color: pageTheme.eyebrowColor }}
          >
            Partnered By {companyConfig.company.name}
          </p>
          <h1
            className="mt-3 font-(family-name:--font-cinema-display) text-5xl sm:text-7xl"
            style={{ color: pageTheme.titleColor }}
          >
            Palme d'Or House
          </h1>
          <p
            className="mt-3 font-(family-name:--font-cinema-body) text-sm tracking-[0.2em]"
            style={{ color: pageTheme.bodyColor }}
          >
            French new Wave · Human-approved scenes · Continuous program
          </p>
        </header>
      </div>
      <PlotToSceneMapper company={company} />
      <ChatbotWidget company={company} />
    </main>
  );
}
