import { env } from "./env";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

//low temp -> crisp summary
// model name

type ModelOpts = {
  temperature?: number;
  maxTokens?: number;
};

/**
 * Builds the configured chat model instance based on the active provider and requested temperature/token settings.
 */
export function getChatModel(opts: ModelOpts = {}): BaseChatModel {
  const temp = opts?.temperature ?? 0.2;

  switch (env.MODEL_PROVIDER) {
    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey: env.GOOGLE_API_KEY,
        model: env.GEMINI_MODEL,
        temperature: temp,
        maxOutputTokens: opts.maxTokens ?? 1024,
      });

    case "groq":
      return new ChatGroq({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL,
        temperature: temp,
        maxTokens: opts.maxTokens,
      });

    case "openai":
    default:
      return new ChatOpenAI({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        temperature: temp,
        maxTokens: opts.maxTokens,
      });
  }
}
