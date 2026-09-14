import { execFile } from "child_process";
import { z } from "zod";
import path from "path";
import fs from "fs";

/**
 * REGLA DE ORO: nunca pasar un string de comando libre a un shell.
 * Solo se permite una lista fija de comandos, cada uno con su propio
 * parseo de argumentos seguro (execFile, no exec/spawn con shell:true).
 */

const ALLOWED_COMMANDS = [
  "npm_install",
  "npm_test",
  "npm_build",
  "git_status",
  "git_diff",
] as const;

export const runCommandSchema = z.object({
  command: z.enum(ALLOWED_COMMANDS),
  workdir: z.string().min(1).max(300),
});

const WORKDIR_ROOT = path.join(__dirname, "..", "..", "sandbox", "tmp");

function resolveWorkdir(workdir: string): string {
  // Evita path traversal: normaliza y verifica que quede dentro del sandbox root.
  const resolved = path.resolve(WORKDIR_ROOT, workdir);
  if (!resolved.startsWith(WORKDIR_ROOT)) {
    throw new Error("workdir fuera del sandbox permitido");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("workdir no existe");
  }
  return resolved;
}

function runExecFile(bin: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function runCommand(input: z.infer<typeof runCommandSchema>) {
  const cwd = resolveWorkdir(input.workdir);

  switch (input.command) {
    case "npm_install":
      return runExecFile("npm", ["install"], cwd, 120_000);
    case "npm_test":
      return runExecFile("npm", ["test"], cwd, 90_000);
    case "npm_build":
      return runExecFile("npm", ["run", "build"], cwd, 120_000);
    case "git_status":
      return runExecFile("git", ["status", "--porcelain"], cwd);
    case "git_diff":
      return runExecFile("git", ["diff"], cwd);
    default:
      // Nunca debería llegar aquí gracias al enum de zod
      throw new Error("comando no soportado");
  }
}
