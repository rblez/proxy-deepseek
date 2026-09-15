import { registry } from "./registry";
import zodToJsonSchema from "zod-to-json-schema";

/**
 * Este texto está escrito para que un LLM que SOLO puede hacer GET y leer
 * el contenido de una página (sin function-calling real, sin headers custom,
 * sin POST) entienda cómo operar este servidor construyendo URLs por sí mismo.
 *
 * No incluye ningún token real — el token lo tiene el humano que use esto
 * y lo pega manualmente en cada URL que le pida al modelo que arme.
 */
export function buildManualText(baseUrl: string): string {
  const lines: string[] = [];

  lines.push("MANUAL DE USO — proxy-deepseek");
  lines.push("");
  lines.push("Este servidor te permite operar sobre un repositorio de GitHub");
  lines.push("(leer archivos, escribir archivos, crear ramas, abrir PRs, clonar,");
  lines.push("y correr comandos npm/git en un sandbox) mediante URLs GET.");
  lines.push("");
  lines.push("FORMATO GENERAL DE CADA LLAMADA:");
  lines.push("");
  lines.push(`  ${baseUrl}/run?token=TOKEN&tool=NOMBRE_TOOL&params=PARAMS_JSON`);
  lines.push("");
  lines.push("Donde:");
  lines.push("  - TOKEN: el token de acceso (te lo da el humano, nunca lo inventes).");
  lines.push("  - NOMBRE_TOOL: uno de los nombres listados abajo.");
  lines.push("  - PARAMS_JSON: un objeto JSON con los parámetros de esa tool,");
  lines.push("    codificado como URL (url-encode), por ejemplo:");
  lines.push(`    params={"repo":"owner/repo","path":"README.md"}`);
  lines.push("    codificado: params=%7B%22repo%22%3A%22owner%2Frepo%22%2C%22path%22%3A%22README.md%22%7D");
  lines.push("");
  lines.push("La respuesta es JSON. Si dice \"truncated\": true, el contenido");
  lines.push("fue cortado para no gastar demasiado espacio — pedí de nuevo con");
  lines.push("un max_chars mayor si necesitas ver más (solo aplica a github_read_file).");
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("TOOLS DISPONIBLES");
  lines.push("=".repeat(60));

  for (const [name, def] of Object.entries(registry)) {
    lines.push("");
    lines.push(`### ${name}`);
    lines.push(def.description);
    const schema = zodToJsonSchema(def.schema as any, { $refStrategy: "none" }) as any;
    const props = schema.properties ?? {};
    const required: string[] = schema.required ?? [];
    lines.push("Parámetros:");
    for (const [propName, propSchema] of Object.entries<any>(props)) {
      const req = required.includes(propName) ? "requerido" : "opcional";
      const type = propSchema.type ?? "unknown";
      const extra = propSchema.description ? ` — ${propSchema.description}` : "";
      lines.push(`  - ${propName} (${type}, ${req})${extra}`);
    }
  }

  lines.push("");
  lines.push("=".repeat(60));
  lines.push("EJEMPLO COMPLETO");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Para leer el README de un repo:");
  lines.push("");
  lines.push(
    `  ${baseUrl}/run?token=TOKEN&tool=github_read_file&params=%7B%22repo%22%3A%22owner%2Frepo%22%2C%22path%22%3A%22README.md%22%7D`
  );
  lines.push("");
  lines.push("NOTA DE SEGURIDAD: el token en la URL puede quedar en logs.");
  lines.push("No lo reutilices para nada más y rótalo periódicamente.");

  return lines.join("\n");
}
