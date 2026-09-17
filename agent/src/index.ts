import "dotenv/config";
import express from "express";
import cors from "cors";
import { searchRouter } from "./routes/search_lcel";
import { plotToSceneRouter } from "./routes/plot_to_scene";

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/search", searchRouter);
app.use("/plot-to-scene", plotToSceneRouter);

const port = Number(process.env.PORT ?? 5000);
app.listen(port, "0.0.0.0", () => {
  console.log(`server is now running on port ${port}`);
});
