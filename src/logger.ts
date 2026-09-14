import fs from "fs";
import path from "path";

const LOG_PATH = path.join(__dirname, "..", "audit.log");

export function logToolCall(tool: string, params: unknown, result: "ok" | "error", detail?: string) {
  const entry = {
    ts: new Date().toISOString(),
    tool,
    params,
    result,
    detail,
  };
  fs.appendFile(LOG_PATH, JSON.stringify(entry) + "\n", (err) => {
    if (err) console.error("No se pudo escribir el log de auditoría:", err);
  });
  // También a stdout, para verlo en Railway logs en tiempo real
  console.log(`[${entry.ts}] ${tool} -> ${result}${detail ? " (" + detail + ")" : ""}`);
}
