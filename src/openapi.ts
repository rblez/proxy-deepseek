import { registry } from "./registry";
import zodToJsonSchema from "zod-to-json-schema";

/**
 * Construye un spec OpenAPI 3.0 a partir del mismo registry que usa /tool
 * y /tools, para que la documentación nunca se desincronice del código real.
 */
export function buildOpenApiSpec() {
  const schemas: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(registry)) {
    schemas[name] = zodToJsonSchema(def.schema as any, { name, $refStrategy: "none" }).definitions?.[name]
      ?? zodToJsonSchema(def.schema as any, { $refStrategy: "none" });
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "proxy-deepseek",
      version: "0.1.0",
      description:
        "Backend de function-calling acotado (GitHub + ejecución whitelisted) para uso con DeepSeek u otro LLM compatible. No es un servidor MCP.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas,
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          summary: "Healthcheck (sin auth)",
          security: [],
          responses: { "200": { description: "OK" } },
        },
      },
      "/tools": {
        get: {
          summary: "Devuelve el schema de todas las tools en formato function-calling",
          responses: { "200": { description: "Lista de tools" }, "401": { description: "Falta token" } },
        },
      },
      "/tool": {
        post: {
          summary: "Ejecuta una tool del registry",
          description:
            "Body: { tool: <nombre>, params: <según el schema de esa tool> }. Ver /tools o los schemas de abajo para los params exactos de cada tool.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tool", "params"],
                  properties: {
                    tool: { type: "string", enum: Object.keys(registry) },
                    params: { type: "object", description: "Ver el schema correspondiente al nombre de la tool en components.schemas" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Resultado de la tool" },
            "400": { description: "Tool desconocida" },
            "401": { description: "Falta token" },
            "403": { description: "Token inválido" },
            "422": { description: "Params inválidos según el schema de la tool" },
            "500": { description: "Falló la ejecución de la tool" },
          },
        },
      },
    },
  };
}
