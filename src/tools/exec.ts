import { execFile } from "child_process";
import { z } from "zod";
import { resolveExistingWorkdir, truncate, MAX_OUTPUT_CHARS } from "./sandbox";

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

function runExecFile(bin: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<{ stdout: string; stderr: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const t = truncate(stderr || err.message, MAX_OUTPUT_CHARS);
        reject(new Error(t.text));
        return;
      }
      const so = truncate(stdout, MAX_OUTPUT_CHARS);
      const se = truncate(stderr, MAX_OUTPUT_CHARS);
      resolve({ stdout: so.text, stderr: se.text, truncated: so.truncated || se.truncated });
    });
  });
}

export async function runCommand(input: z.infer<typeof runCommandSchema>) {
  const cwd = resolveExistingWorkdir(input.workdir);

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
