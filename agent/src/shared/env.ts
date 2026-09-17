import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.string().default("5000"),
  ALLOWED_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean)),
  MODEL_PROVIDER: z.enum(["openai", "gemini", "groq"]).default("groq"),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash-lite"),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  SEARCH_PROVIDER: z.string().default("tavily"),
  TAVILY_API_KEY: z.string().optional(),
  MONGODB_URI: z.string().url().optional(),
  MONGODB_DB_NAME: z.string().default("company_knowledge_base"),
  KB_DOCUMENTS_DIR: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
