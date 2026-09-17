
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,json,mdx}",
  ],

  theme: {
    extend: {
      keyframes: {
        "chatbot-orb-one": {
          "0%, 100%": {
            transform: "translate3d(0, 0, 0)",
          },
          "50%": {
            transform: "translate3d(-20px, 30px, 0)",
          },
        },

        "chatbot-orb-two": {
          "0%, 100%": {
            transform: "translate3d(0, 0, 0)",
          },
          "50%": {
            transform: "translate3d(30px, -20px, 0)",
          },
        },

        "chatbot-logo-pulse": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-2px)",
          },
        },

        "chatbot-logo-ring": {
          "0%": {
            transform: "scale(0.9)",
            opacity: "0.25",
          },
          "100%": {
            transform: "scale(1.45)",
            opacity: "0",
          },
        },

        "chatbot-welcome-in": {
          from: {
            opacity: "0",
            transform: "translateY(18px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },

        "chatbot-welcome-float": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-6px)",
          },
        },

        "chatbot-spark": {
          "0%, 100%": {
            opacity: "0.25",
            transform: "scale(0.7) rotate(0deg)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.15) rotate(20deg)",
          },
        },

        "chatbot-status-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 4px rgba(34,197,94,0.08)",
          },
          "50%": {
            boxShadow: "0 0 0 7px rgba(34,197,94,0)",
          },
        },

        "chatbot-message-in": {
          from: {
            opacity: "0",
            transform: "translateY(12px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },

        "chatbot-avatar-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.05)",
          },
        },

        "chatbot-typing": {
          "0%, 60%, 100%": {
            opacity: "0.3",
            transform: "translateY(0)",
          },
          "30%": {
            opacity: "1",
            transform: "translateY(-4px)",
          },
        },

        "chatbot-launcher-glow": {
          "0%, 100%": {
            transform: "scale(0.92)",
            opacity: "0.25",
          },
          "50%": {
            transform: "scale(1.12)",
            opacity: "0.45",
          },
        },

        "chatbot-launcher-shine": {
          from: {
            transform: "translateX(-50%) rotate(20deg)",
          },
          to: {
            transform: "translateX(50%) rotate(20deg)",
          },
        },

        "chatbot-icon-float": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-2px)",
          },
        },

        "chatbot-unread-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.2)",
          },
        },
      },

      animation: {
        "chatbot-orb-one":
          "chatbot-orb-one 8s ease-in-out infinite",

        "chatbot-orb-two":
          "chatbot-orb-two 10s ease-in-out infinite",

        "chatbot-logo-pulse":
          "chatbot-logo-pulse 3s ease-in-out infinite",

        "chatbot-logo-ring":
          "chatbot-logo-ring 2.8s ease-out infinite",

        "chatbot-welcome-in":
          "chatbot-welcome-in 500ms ease-out",

        "chatbot-welcome-float":
          "chatbot-welcome-float 4s ease-in-out infinite",

        "chatbot-spark":
          "chatbot-spark 2s infinite",

        "chatbot-status-pulse":
          "chatbot-status-pulse 2s ease-in-out infinite",

        "chatbot-message-in":
          "chatbot-message-in 400ms ease-out",

        "chatbot-avatar-pulse":
          "chatbot-avatar-pulse 1.5s infinite",

        "chatbot-typing":
          "chatbot-typing 1.15s infinite",

        "chatbot-launcher-glow":
          "chatbot-launcher-glow 2.7s infinite",

        "chatbot-launcher-shine":
          "chatbot-launcher-shine 3.2s infinite",

        "chatbot-icon-float":
          "chatbot-icon-float 3s ease-in-out infinite",

        "chatbot-unread-pulse":
          "chatbot-unread-pulse 2s infinite",
      },
    },
  },
};

export default config;