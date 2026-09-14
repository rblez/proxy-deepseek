import "dotenv/config";
import express from "express";
import { requireAuth } from "./auth";
import { registry, getToolsSchemaForLLM } from "./registry";
import { logToolCall } from "./logger";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Todas las rutas requieren Bearer token, nunca ?key= en la URL.
app.use(requireAuth);

app.get("/tools", (_req, res) => {
  res.json({ tools: getToolsSchemaForLLM() });
});

app.post("/tool", async (req, res) => {
  const { tool, params } = req.body ?? {};

  if (typeof tool !== "string" || !(tool in registry)) {
    return res.status(400).json({ error: "unknown_tool", tool });
  }

  const def = registry[tool];
  const parsed = def.schema.safeParse(params);

  if (!parsed.success) {
    logToolCall(tool, params, "error", "validation_failed");
    return res.status(422).json({ error: "invalid_params", details: parsed.error.flatten() });
  }

  try {
    const result = await def.handler(parsed.data);
    logToolCall(tool, parsed.data, "ok");
    res.json({ result });
  } catch (err: any) {
    logToolCall(tool, parsed.data, "error", err.message);
    res.status(500).json({ error: "tool_execution_failed", detail: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => {
  console.log(`proxy-deepseek escuchando en puerto ${port}`);
});
