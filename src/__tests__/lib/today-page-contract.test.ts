import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('today command center contract', () => {
  it('uses the existing agent draft approval endpoint instead of a duplicate route', () => {
    const component = readFileSync(join(root, 'src/components/today/ActionDraftApprovals.tsx'), 'utf8');

    expect(component).toContain('/api/ai/agent/action-drafts/${id}/approve');
    expect(existsSync(join(root, 'src/app/api/ai/agent/action-drafts/[id]/route.ts'))).toBe(false);
  });

  it('keeps edit-before-approve controls for actionable draft fields', () => {
    const component = readFileSync(join(root, 'src/components/today/ActionDraftApprovals.tsx'), 'utf8');

    expect(component).toContain('Draft title');
    expect(component).toContain('Draft description');
    expect(component).toContain('Draft category');
    expect(component).toContain('Draft priority');
  });
});
