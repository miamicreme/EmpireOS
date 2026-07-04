import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('passkey enrollment contract', () => {
  it('adds a one-time enrollment token table', () => {
    const migration = 'supabase/migrations/0020_passkey_enrollment_tokens.sql';
    expect(existsSync(join(root, migration))).toBe(true);
    const source = read(migration);
    expect(source).toContain('passkey_enrollment_tokens');
    expect(source).toContain('token_hash text not null unique');
    expect(source).toContain('expires_at timestamptz not null');
    expect(source).toContain('used_at timestamptz');
  });

  it('allows the iPhone enrollment page before login while keeping APIs self-protected', () => {
    const middleware = read('src/middleware.ts');
    expect(middleware).toContain("pathname.startsWith('/passkeys/enroll/')");
    expect(middleware).toContain('!isPasskeyEnrollment');
    expect(middleware).toContain("pathname.startsWith('/api')");
  });

  it('exposes a sessionless enrollment page for iPhone pairing', () => {
    const page = read('src/app/passkeys/enroll/[token]/page.tsx');
    const workbench = read('src/components/auth/PasskeyEnrollmentWorkbench.tsx');
    const helper = read('src/lib/auth/passkey-enrollment.ts');
    expect(page).toContain('Add another device');
    expect(workbench).toContain('Add this iPhone to Empire OS');
    expect(workbench).toContain('This adds your iPhone without removing your Windows passkey.');
    expect(workbench).toContain('This link expires in 10 minutes.');
    expect(workbench).toContain('Only open this link on a device you control.');
    expect(workbench).toContain('Create Face ID passkey');
    expect(workbench).toContain('/api/auth/passkeys/enrollment/${token}/status');
    expect(workbench).toContain('/api/auth/passkeys/enrollment/${token}/register/options');
    expect(workbench).toContain('/api/auth/passkeys/enrollment/${token}/register/verify');
    expect(helper).toContain('/passkeys/enroll/${token}');
  });

  it('separates passkey actions on the settings page', () => {
    const settings = read('src/app/settings/passkeys/page.tsx');
    expect(settings).toContain('Add passkey on this device');
    expect(settings).toContain('Add another device');
    expect(settings).toContain('Emergency recovery');
    expect(settings).toContain('Enrollment link for iPhone');
    expect(settings).toContain('Scan this with your iPhone camera');
    expect(settings).toContain('This does not remove your Windows passkey.');
  });

  it('documents safer login copy for new-phone setup', () => {
    const login = read('src/app/login/page.tsx');
    expect(login).toContain('New phone? Use Add another device from a signed-in device.');
    expect(login).toContain('Emergency recovery is only if all passkeys are lost.');
  });

  it('uses the canonical enrollment APIs and keeps status secret-free', () => {
    const create = read('src/app/api/auth/passkeys/enrollment/route.ts');
    const status = read('src/app/api/auth/passkeys/enrollment/[token]/status/route.ts');
    const options = read('src/app/api/auth/passkeys/enrollment/[token]/register/options/route.ts');
    const verify = read('src/app/api/auth/passkeys/enrollment/[token]/register/verify/route.ts');
    const helper = read('src/lib/auth/passkey-enrollment.ts');

    expect(create).toContain('createEnrollmentToken');
    expect(create).toContain('nextUrl');
    expect(status).toContain('getEnrollmentStatus');
    expect(status).not.toContain('user_id');
    expect(options).toContain('getValidEnrollmentToken');
    expect(options).toContain('labelHint');
    expect(verify).toContain('markEnrollmentTokenUsed');
    expect(verify).toContain("nextUrl: '/today'");
    expect(helper).toContain('token_hash');
    expect(helper).toContain('expires_at');
    expect(helper).toContain('used_at');
  });
});
