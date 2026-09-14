import { Octokit } from "@octokit/rest";
import { z } from "zod";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// --- Schemas de validación (nunca confiar en lo que manda el LLM sin validar) ---

const repoSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "formato esperado: owner/repo");
const pathSchema = z.string().min(1).max(500);
const branchSchema = z.string().min(1).max(200).optional();

export const readFileSchema = z.object({
  repo: repoSchema,
  path: pathSchema,
  branch: branchSchema,
});

export const listFilesSchema = z.object({
  repo: repoSchema,
  path: pathSchema.optional().default(""),
});

export const writeFileSchema = z.object({
  repo: repoSchema,
  path: pathSchema,
  content: z.string(),
  branch: z.string().min(1),
  commit_message: z.string().min(1).max(500),
});

export const createBranchSchema = z.object({
  repo: repoSchema,
  branch_name: z.string().min(1).max(200),
  from_branch: z.string().min(1).max(200).optional().default("main"),
});

export const openPrSchema = z.object({
  repo: repoSchema,
  branch: z.string().min(1),
  base: z.string().min(1).optional().default("main"),
  title: z.string().min(1).max(300),
  body: z.string().optional().default(""),
});

export const getPrStatusSchema = z.object({
  repo: repoSchema,
  pr_number: z.number().int().positive(),
});

export const searchCodeSchema = z.object({
  repo: repoSchema,
  query: z.string().min(1).max(300),
});

// --- Implementación ---

function splitRepo(repo: string) {
  const [owner, name] = repo.split("/");
  return { owner, repo: name };
}

export async function githubReadFile(input: z.infer<typeof readFileSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  const res = await octokit.repos.getContent({
    owner,
    repo,
    path: input.path,
    ref: input.branch,
  });
  if (Array.isArray(res.data) || !("content" in res.data)) {
    throw new Error("La ruta es un directorio, no un archivo. Usa github_list_files.");
  }
  const content = Buffer.from(res.data.content, "base64").toString("utf-8");
  return { path: input.path, content, sha: res.data.sha };
}

export async function githubListFiles(input: z.infer<typeof listFilesSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  const res = await octokit.repos.getContent({ owner, repo, path: input.path });
  if (!Array.isArray(res.data)) {
    throw new Error("La ruta es un archivo, no un directorio.");
  }
  return res.data.map((f) => ({ name: f.name, path: f.path, type: f.type, size: f.size }));
}

export async function githubWriteFile(input: z.infer<typeof writeFileSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: input.path,
      ref: input.branch,
    });
    if (!Array.isArray(existing.data) && "sha" in existing.data) {
      sha = existing.data.sha;
    }
  } catch {
    // El archivo no existe todavía, se crea nuevo (sha queda undefined)
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.path,
    message: input.commit_message,
    content: Buffer.from(input.content, "utf-8").toString("base64"),
    branch: input.branch,
    sha,
  });
  return { commit_sha: res.data.commit.sha, path: input.path };
}

export async function githubCreateBranch(input: z.infer<typeof createBranchSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  const base = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${input.from_branch}`,
  });
  const res = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${input.branch_name}`,
    sha: base.data.object.sha,
  });
  return { branch: input.branch_name, sha: res.data.object.sha };
}

export async function githubOpenPr(input: z.infer<typeof openPrSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  const res = await octokit.pulls.create({
    owner,
    repo,
    head: input.branch,
    base: input.base,
    title: input.title,
    body: input.body,
  });
  return { pr_number: res.data.number, url: res.data.html_url };
}

export async function githubGetPrStatus(input: z.infer<typeof getPrStatusSchema>) {
  const { owner, repo } = splitRepo(input.repo);
  const pr = await octokit.pulls.get({ owner, repo, pull_number: input.pr_number });
  const checks = await octokit.checks.listForRef({
    owner,
    repo,
    ref: pr.data.head.sha,
  });
  return {
    state: pr.data.state,
    mergeable: pr.data.mergeable,
    checks: checks.data.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
  };
}

export async function githubSearchCode(input: z.infer<typeof searchCodeSchema>) {
  const res = await octokit.search.code({ q: `${input.query} repo:${input.repo}` });
  return res.data.items.map((i) => ({ path: i.path, sha: i.sha, url: i.html_url }));
}
