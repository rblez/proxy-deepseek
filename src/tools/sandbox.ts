import path from "path";
import fs from "fs";

export const WORKDIR_ROOT = path.join(__dirname, "..", "..", "sandbox", "tmp");

// Nombre de workdir: sin slashes, sin "..", sin caracteres raros.
// Esto es más estricto que solo revisar el resultado de path.resolve,
// porque bloquea también nombres como "a/../../etc" antes de resolverlos.
const SAFE_NAME = /^[a-zA-Z0-9_.-]+$/;

export function assertSafeWorkdirName(workdir: string) {
  if (!SAFE_NAME.test(workdir) || workdir === "." || workdir === "..") {
    throw new Error("nombre de workdir inválido: solo letras, números, guiones y puntos, sin rutas anidadas");
  }
}

export function resolveExistingWorkdir(workdir: string): string {
  assertSafeWorkdirName(workdir);
  const resolved = path.resolve(WORKDIR_ROOT, workdir);
  if (!resolved.startsWith(WORKDIR_ROOT)) {
    throw new Error("workdir fuera del sandbox permitido");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("workdir no existe. Clónalo primero con github_clone_repo.");
  }
  return resolved;
}

export function resolveNewWorkdir(workdir: string): string {
  assertSafeWorkdirName(workdir);
  fs.mkdirSync(WORKDIR_ROOT, { recursive: true });
  const resolved = path.resolve(WORKDIR_ROOT, workdir);
  if (!resolved.startsWith(WORKDIR_ROOT)) {
    throw new Error("workdir fuera del sandbox permitido");
  }
  if (fs.existsSync(resolved)) {
    throw new Error("ya existe un workdir con ese nombre. Usa otro nombre o borra el anterior.");
  }
  return resolved;
}

export function truncate(text: string, maxChars: number): { text: string; truncated: boolean; original_length: number } {
  if (text.length <= maxChars) {
    return { text, truncated: false, original_length: text.length };
  }
  return {
    text: text.slice(0, maxChars) + `\n... [truncado, ${text.length - maxChars} caracteres omitidos]`,
    truncated: true,
    original_length: text.length,
  };
}

export const MAX_OUTPUT_CHARS = Number(process.env.MAX_TOOL_OUTPUT_CHARS ?? 4000);
