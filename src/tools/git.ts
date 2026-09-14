import { execFile } from "child_process";
import { z } from "zod";
import { resolveNewWorkdir } from "./sandbox";

export const cloneRepoSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "formato esperado: owner/repo"),
  workdir: z.string().min(1).max(100),
  branch: z.string().min(1).max(200).optional(),
});

/**
 * CRÍTICO: cuando execFile falla, Node arma el mensaje de error incluyendo
 * el comando completo con sus argumentos — y uno de esos argumentos es la
 * URL con el token embebido (https://x-access-token:TOKEN@github.com/...).
 * Si ese mensaje se loguea o se devuelve tal cual al LLM, el token se filtra.
 * Por eso TODA salida de esta función pasa por este sanitizador antes de
 * salir de la función, sin excepción.
 */
function redactToken(text: string): string {
  return text.replace(/x-access-token:[^@]+@/g, "x-access-token:***@");
}

export async function githubCloneRepo(input: z.infer<typeof cloneRepoSchema>) {
  // Validar el workdir ANTES que cualquier otra cosa (incluido si hay token
  // configurado) — nunca depender del orden de checks externos para que
  // las validaciones de input hagan su trabajo.
  const target = resolveNewWorkdir(input.workdir);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN no configurado en el servidor");
  }

  const cloneUrl = `https://x-access-token:${token}@github.com/${input.repo}.git`;

  const args = ["clone", "--depth", "1"];
  if (input.branch) {
    args.push("-b", input.branch);
  }
  args.push(cloneUrl, target);

  return new Promise<{ workdir: string; repo: string }>((resolve, reject) => {
    execFile("git", args, { timeout: 60_000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(redactToken(stderr || err.message)));
        return;
      }
      resolve({ workdir: input.workdir, repo: input.repo });
    });
  });
}
