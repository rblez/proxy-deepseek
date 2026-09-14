import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import * as gh from "./tools/github";
import * as exec from "./tools/exec";

type ToolDef = {
  description: string;
  schema: z.ZodTypeAny;
  handler: (input: any) => Promise<unknown>;
};

export const registry: Record<string, ToolDef> = {
  github_read_file: {
    description: "Lee el contenido de un archivo de un repo de GitHub.",
    schema: gh.readFileSchema,
    handler: gh.githubReadFile,
  },
  github_list_files: {
    description: "Lista archivos/directorios en una ruta de un repo.",
    schema: gh.listFilesSchema,
    handler: gh.githubListFiles,
  },
  github_write_file: {
    description: "Crea o actualiza un archivo en una rama específica (nunca directo a main sin PR).",
    schema: gh.writeFileSchema,
    handler: gh.githubWriteFile,
  },
  github_create_branch: {
    description: "Crea una rama nueva a partir de otra (por defecto main).",
    schema: gh.createBranchSchema,
    handler: gh.githubCreateBranch,
  },
  github_open_pr: {
    description: "Abre un Pull Request de una rama hacia base (por defecto main).",
    schema: gh.openPrSchema,
    handler: gh.githubOpenPr,
  },
  github_get_pr_status: {
    description: "Consulta el estado y checks de CI de un PR.",
    schema: gh.getPrStatusSchema,
    handler: gh.githubGetPrStatus,
  },
  github_search_code: {
    description: "Busca código dentro de un repo.",
    schema: gh.searchCodeSchema,
    handler: gh.githubSearchCode,
  },
  run_command: {
    description: "Ejecuta un comando de una lista fija (npm_install, npm_test, npm_build, git_status, git_diff) en un workdir del sandbox.",
    schema: exec.runCommandSchema,
    handler: exec.runCommand,
  },
};

/**
 * Genera el array de "tools" en formato function-calling (compatible con
 * la API de DeepSeek, que sigue el esquema estilo OpenAI).
 */
export function getToolsSchemaForLLM() {
  return Object.entries(registry).map(([name, def]) => ({
    type: "function",
    function: {
      name,
      description: def.description,
      // Cast a any: con Record<string, ToolDef> y schemas zod heterogéneos,
      // TS intenta instanciar un tipo genérico excesivamente profundo.
      // El runtime es correcto; solo el chequeo estático se satura.
      parameters: zodToJsonSchema(def.schema as any, name),
    },
  }));
}
