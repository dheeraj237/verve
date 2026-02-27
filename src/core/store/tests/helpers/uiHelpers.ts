import { TestEnv } from './workspaceTestHelpers';

export async function assertFileIsVisible(env: TestEnv, path: string, expectedContent: string) {
  const file = await env.db.findByPath(path);
  if (!file) throw new Error(`file not found: ${path}`);
  if (file.content !== expectedContent) throw new Error(`unexpected content for ${path}`);
  return true;
}

export async function assertFileTreeMatches(env: TestEnv, expectedPaths: string[]) {
  const files = await env.db.queryAll();
  const paths = files.map((f: any) => f.path).sort();
  expectedPaths = expectedPaths.slice().sort();
  if (paths.length !== expectedPaths.length || !paths.every((p, i) => p === expectedPaths[i])) {
    throw new Error(`file tree mismatch. got=${JSON.stringify(paths)} expected=${JSON.stringify(expectedPaths)}`);
  }
  return true;
}
