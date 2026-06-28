/**
 * Doc link validator — scans all .md files under docs/ for internal relative
 * links and asserts each target file actually exists.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DOCS_ROOT = path.resolve(__dirname, '../../../docs');

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract relative internal links from Markdown.
 * Matches [text](./foo) and [text](../bar/baz.md) — skips http/https/mailto.
 */
function extractInternalLinks(content: string): string[] {
  const links: string[] = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const raw = m[2] ?? '';
    const href = (raw.split('#')[0] ?? '').trim(); // strip fragment
    if (!href) continue;
    if (/^https?:\/\//i.test(href)) continue;
    if (/^mailto:/i.test(href)) continue;
    links.push(href);
  }
  return links;
}

describe('docs internal links', () => {
  const mdFiles = collectMdFiles(DOCS_ROOT);

  it('finds at least one markdown file in docs/', () => {
    expect(mdFiles.length).toBeGreaterThan(0);
  });

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const links = extractInternalLinks(content);

    if (links.length === 0) continue;

    it(`all links in ${path.relative(DOCS_ROOT, file)} resolve`, () => {
      for (const link of links) {
        const resolved = path.resolve(path.dirname(file), link);
        expect(
          fs.existsSync(resolved),
          `Broken link "${link}" in ${path.relative(DOCS_ROOT, file)} → ${resolved}`,
        ).toBe(true);
      }
    });
  }
});
