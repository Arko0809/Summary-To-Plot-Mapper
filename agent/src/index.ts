import "dotenv/config";
import express from "express";
import cors from "cors";
import { searchRouter } from "./routes/search_lcel";
import { plotToSceneRouter } from "./routes/plot_to_scene";

const app = express();
const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, "");
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const isAllowedOrigin = (origin: string) => {
  const normalizedOrigin = normalizeOrigin(origin);

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === "*") return true;

    if (allowedOrigin.includes("*")) {
      const escaped = allowedOrigin
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\\*/g, ".*");
      return new RegExp(`^${escaped}$`).test(normalizedOrigin);
    }

    return allowedOrigin === normalizedOrigin;
  });
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

app.use(express.json());

app.use("/search", searchRouter);
app.use("/plot-to-scene", plotToSceneRouter);

const port = Number(process.env.PORT ?? 5000);
app.listen(port, "0.0.0.0", () => {
  console.log(`server is now running on port ${port}`);
});
