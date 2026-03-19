import type { N8nRuntime } from './types.js';

const GITHUB_PAT = '__APERTURE_GITHUB_PAT__';
const GITHUB_REPO = 'garyneville/aperture';
const GH_PAGES_BRANCH = 'main';

async function getFileSha(filePath: string): Promise<string | undefined> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GH_PAGES_BRANCH}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new Error(`GitHub GET ${filePath}: ${resp.status}`);
  const data = await resp.json() as { sha?: string };
  return data.sha;
}

async function putFile(
  filePath: string,
  content: string,
  sha: string | undefined,
  message: string,
): Promise<void> {
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  const body: Record<string, string> = { message, content: encoded, branch: GH_PAGES_BRANCH };
  if (sha) body.sha = sha;

  const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub PUT ${filePath}: ${resp.status} — ${text.slice(0, 200)}`);
  }
}

function archivePath(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `archive/${yyyy}-${mm}-${dd}.html`;
}

export async function run({ $input }: N8nRuntime) {
  const item = $input.first().json as Record<string, unknown>;
  const siteHtml = item.siteHtml as string | undefined;

  if (!siteHtml) {
    console.warn('[publish-site] siteHtml absent — skipping GitHub Pages publish');
    return [{ json: { published: false, reason: 'siteHtml absent' } }];
  }

  const path = archivePath();
  const commitMsg = `chore: publish photo brief ${path.slice(8, 18)}`;

  // Sequential writes: fetch SHA immediately before each PUT to avoid 409 conflicts.
  // Archive SHA is also fetched — handles same-day re-runs gracefully.
  const indexSha = await getFileSha('index.html');
  await putFile('index.html', siteHtml, indexSha, commitMsg);

  const archiveSha = await getFileSha(path);
  await putFile(path, siteHtml, archiveSha, commitMsg);

  return [{ json: { published: true, archivePath: path } }];
}
