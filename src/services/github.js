import { Octokit } from "@octokit/rest";

const SKIP_DIRS = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    "vendor",
    "target",
    "__pycache__",
    ".gradle",
  ];

const SKIP_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp",
    "woff", "woff2", "ttf", "eot", "otf",
    "mp3", "mp4", "mov", "wav", "webm",
    "exe", "dll", "so", "dylib", "bin", "wasm",
    "class", "jar", "war", "ear",
    "zip", "tar", "gz", "tgz", "7z", "rar",
    "pdf", "lock", "map",
  ]);

const SKIP_FILES = new Set([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "composer.lock",
    "go.sum",
  ]);


function shouldSkipFile(path, size) {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];

  if (parts.some((part) => SKIP_DIRS.includes(part))) return true;
  if (SKIP_FILES.has(fileName)) return true;
  if (typeof size === "number" && size > 200_000) return true;

  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
    : "";

  if (SKIP_EXTENSIONS.has(ext)) return true;
  if (fileName.endsWith(".min.js")) return true;

  return false;
}

//! Repo kk URL ss {owner, repo, repoKey} ko nikal kk return kr dega .. 
export function parseRepo(input) {
  const clean = input
    .replace("https://github.com/", "")
    .replace("http://github.com/", "")
    .replace(/\.git$/, "");

  const [owner, repo] = clean.split("/");
  return { owner, repo, repoKey: `${owner}/${repo}` };
}

export async function fetchRepoFiles(token,owner,repo) {
  const octokit = new Octokit({ auth: token });

  const {data : repoInfo} = await octokit.rest.repos.get({ owner, repo }).catch((error) => {
    if(err.status === 404) {
      throw new Error(`Github Could Not Find ${owner}/${repo} Repository . Fine-Grained Tokens must include this repo`);
    };
    throw err;
  });

  //! recursive true because we want to get all files in the repo, including those in subdirectories.
  const {data: tree} = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: repoInfo.default_branch,
    recursive: "true",
  });

  const files = [];

  for (const item of tree.tree) {
    if(item.type !== "blob") continue;
    if(shouldSkipFile(item.path, item.size)) continue;

    const {data: blob} = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: item.sha,
    });

    files.push({
      path: item.path,
      content: Buffer.from(blob.content, "base64").toString("utf-8"),
    })

    if(files.length > 200) break;
  }

  return files;

}

