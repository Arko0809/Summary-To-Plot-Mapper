"use client";

import Link from "next/link";
import chatbotConfig from "@/config/chatbot-config.json";

const companies = Object.entries(chatbotConfig).map(([key, config]) => ({
  key,
  name: config.company.name,
  shortName: config.company.shortName,
  logo: config.company.logo,
  theme: config.theme,
}));

export default function HomePage() {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "linear-gradient(135deg, #0b0b0f 0%, #15181d 30%, #0f172a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{
        backgroundImage:
          "radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, transparent 60%)",
      }} />

      <div className="relative w-full max-w-5xl rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm sm:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-300">
            Brand Experience
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
            Choose a company
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
            Explore the themed experience for each partner and go directly to its dedicated page.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {companies.map(({ key, name, logo, shortName, theme }) => (
            <Link
              key={key}
              href={`/${key}`}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/50 p-5 text-left transition-transform duration-200 hover:-translate-y-1 hover:border-white/20"
            >
              <div
                className="absolute inset-0 opacity-90"
                style={{
                  background: theme.brandGradient,
                }}
              />

              <div className="relative flex h-full items-center gap-4 rounded-[20px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/90 shadow-lg">
                  <img
                    src={logo}
                    alt={`${name} logo`}
                    className="h-10 w-10 object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                    {shortName}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">{name}</div>
                  <div className="mt-2 text-sm text-white/80">
                    Open brand workspace
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

