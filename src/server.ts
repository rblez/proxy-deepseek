import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { requireAuth, isValidGetToken } from "./auth";
import { registry, getToolsSchemaForLLM } from "./registry";
import { logToolCall } from "./logger";
import { buildOpenApiSpec } from "./openapi";
import { buildManualText } from "./manual";

const app = express();
app.use(express.json({ limit: "2mb" }));

async function executeTool(tool: unknown, params: unknown) {
  if (typeof tool !== "string" || !(tool in registry)) {
    return { httpStatus: 400, body: { error: "unknown_tool", tool } };
  }

  const def = registry[tool];
  const parsed = def.schema.safeParse(params);

  if (!parsed.success) {
    logToolCall(tool, params, "error", "validation_failed");
    return { httpStatus: 422, body: { error: "invalid_params", details: parsed.error.flatten() } };
  }

  try {
    const result = await def.handler(parsed.data);
    logToolCall(tool, parsed.data, "ok");
    return { httpStatus: 200, body: { result } };
  } catch (err: any) {
    logToolCall(tool, parsed.data, "error", err.message);
    return { httpStatus: 500, body: { error: "tool_execution_failed", detail: err.message } };
  }
}

// Healthcheck SIN auth: los orquestadores (Railway, etc.) lo golpean sin token.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// /docs también sin auth de por sí: es solo documentación (nombres de tools,
// forma de los params), no expone secretos ni ejecuta nada. La ejecución real
// vía "Try it out" sigue exigiendo el Bearer token en cada request a /tool.
const openApiSpec = buildOpenApiSpec();
app.get("/openapi.json", (_req, res) => res.json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

/**
 * /manual: página de texto plano, sin JS, pensada para clientes que solo
 * saben hacer GET y leer el contenido de una página (ej. la app de DeepSeek
 * para Android en modo "Buscar"). Explica cómo construir URLs para /run.
 * Sin auth: es documentación, no ejecuta nada. No incluye ningún token real.
 */
app.get("/manual", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(buildManualText(baseUrl));
});

/**
 * GET /run — ejecución vía query string, para clientes sin capacidad de
 * mandar headers custom ni hacer POST con body JSON.
 * COMPROMISO DELIBERADO DE SEGURIDAD: el token va en la URL (ver auth.ts).
 * Usa GET_ACCESS_TOKEN, un token separado del PROXY_TOKEN de /tool.
 * params se manda como JSON serializado y URL-encoded en el query string.
 */
app.get("/run", async (req, res) => {
  if (!isValidGetToken(req.query.token)) {
    return res.status(403).json({ error: "invalid_or_missing_token" });
  }

  const tool = req.query.tool;
  let params: unknown = {};
  if (typeof req.query.params === "string" && req.query.params.length > 0) {
    try {
      params = JSON.parse(req.query.params);
    } catch {
      return res.status(400).json({ error: "params_must_be_valid_json" });
    }
  }

  const { httpStatus, body } = await executeTool(tool, params);
  res.status(httpStatus).json(body);
});

// Todas las demás rutas requieren Bearer token, nunca ?key= en la URL.
app.use(requireAuth);

app.get("/tools", (_req, res) => {
  res.json({ tools: getToolsSchemaForLLM() });
});

app.post("/tool", async (req, res) => {
  const { httpStatus, body } = await executeTool(req.body?.tool, req.body?.params);
  res.status(httpStatus).json(body);
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => {
  console.log(`proxy-deepseek escuchando en puerto ${port}`);
});

