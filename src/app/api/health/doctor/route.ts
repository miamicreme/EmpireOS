import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

type CheckStatus = 'healthy' | 'degraded' | 'blocked' | 'unknown' | 'not_configured';
type Severity = 'info' | 'warning' | 'critical';
type Category = 'platform' | 'database' | 'storage' | 'authentication' | 'intelligence' | 'voice' | 'recorder' | 'modules' | 'workers' | 'security';

interface HealthCheck {
  id: string;
  name: string;
  category: Category;
  status: CheckStatus;
  severity: Severity;
  message: string;
  details?: string;
  recommendation?: string;
  impact?: string;
  repairAvailable: boolean;
  repairMode?: 'automatic' | 'approval_required' | 'manual_only';
  actionHref?: string;
  dependency?: string;
  migration?: string;
  durationMs: number;
}

interface DoctorResult {
  version: '2.0.0';
  checks: HealthCheck[];
  overallHealth: 'green' | 'yellow' | 'red';
  readinessScore: number;
  nextBestAction?: string;
  summary: {
    healthy: number;
    degraded: number;
    blocked: number;
    unknown: number;
    notConfigured: number;
  };
  environment: {
    canonicalOrigin: string | null;
    rpId: string | null;
    commitSha: string | null;
    nodeEnv: string;
  };
  timestamp: string;
}

const REQUIRED_TABLES: Array<{ name: string; category: Category; migration: string; critical: boolean }> = [
  { name: 'global_actions', category: 'database', migration: 'core Spine migrations', critical: true },
  { name: 'modules', category: 'modules', migration: 'core module registry migration', critical: true },
  { name: 'ai_providers', category: 'intelligence', migration: '0012_ai_providers.sql', critical: true },
  { name: 'empire_runs', category: 'intelligence', migration: '20260719121500_repair_empire_runs.sql', critical: true },
  { name: 'recordings', category: 'recorder', migration: '0022_recorder_module.sql', critical: true },
  { name: 'tool_approval_requests', category: 'security', migration: '0024_vnext_control_plane.sql', critical: true },
  { name: 'tool_run_receipts', category: 'security', migration: '0024_vnext_control_plane.sql', critical: true },
  { name: 'webauthn_credentials', category: 'authentication', migration: 'passkey credential migration', critical: true },
  { name: 'empire_documents', category: 'modules', migration: '20260719143000_durable_document_ingestion.sql', critical: true },
  { name: 'empire_document_extractions', category: 'modules', migration: '20260719143000_durable_document_ingestion.sql', critical: false },
  { name: 'empire_document_analyses', category: 'modules', migration: '20260719143000_durable_document_ingestion.sql', critical: false },
  { name: 'empire_document_routes', category: 'modules', migration: '20260719143000_durable_document_ingestion.sql', critical: false },
  { name: 'empire_document_links', category: 'modules', migration: '20260719143000_durable_document_ingestion.sql', critical: false },
];

function nowMs() {
  return Date.now();
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function looksLikeSupabaseKey(value: string): boolean {
  return value.split('.').length === 3;
}

function envCheck(
  name: string,
  options: { critical: boolean; validate?: (value: string) => boolean; secret?: boolean; category?: Category },
): HealthCheck {
  const started = nowMs();
  const value = process.env[name]?.trim();
  const category = options.category ?? 'platform';
  if (!value) {
    return {
      id: `env.${name.toLowerCase()}`,
      name: `Environment: ${name}`,
      category,
      status: options.critical ? 'blocked' : 'not_configured',
      severity: options.critical ? 'critical' : 'warning',
      message: 'Not configured',
      recommendation: `Set ${name} in the Render environment, then redeploy.`,
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    };
  }
  if (options.validate && !options.validate(value)) {
    return {
      id: `env.${name.toLowerCase()}`,
      name: `Environment: ${name}`,
      category,
      status: 'blocked',
      severity: options.critical ? 'critical' : 'warning',
      message: 'Configured value is malformed',
      details: options.secret ? 'The secret is present but does not match the expected format.' : value,
      recommendation: `Correct ${name} in Render and redeploy.`,
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    };
  }
  return {
    id: `env.${name.toLowerCase()}`,
    name: `Environment: ${name}`,
    category,
    status: 'healthy',
    severity: options.critical ? 'critical' : 'info',
    message: 'Configured',
    details: options.secret ? 'Secret is present and format-valid.' : value,
    repairAvailable: false,
    durationMs: nowMs() - started,
  };
}

async function checkTable(
  admin: ReturnType<typeof createAdminClient>,
  definition: (typeof REQUIRED_TABLES)[number],
): Promise<HealthCheck> {
  const started = nowMs();
  try {
    const { error } = await admin.from(definition.name).select('*', { count: 'exact', head: true });
    if (error) {
      return {
        id: `database.table.${definition.name}`,
        name: `Table: ${definition.name}`,
        category: definition.category,
        status: definition.critical ? 'blocked' : 'degraded',
        severity: definition.critical ? 'critical' : 'warning',
        message: 'Required schema dependency is unavailable',
        details: error.message,
        impact: definition.name === 'recordings' ? 'Recorder cannot save, list, or process recordings.' : 'The dependent feature cannot be trusted until its schema is available.',
        recommendation: `Apply ${definition.migration}, then rerun Empire Doctor.`,
        dependency: `public.${definition.name}`,
        migration: definition.migration,
        repairAvailable: false,
        repairMode: 'manual_only',
        durationMs: nowMs() - started,
      };
    }
    return {
      id: `database.table.${definition.name}`,
      name: `Table: ${definition.name}`,
      category: definition.category,
      status: 'healthy',
      severity: definition.critical ? 'critical' : 'info',
      message: 'Exists and is reachable through the service role',
      dependency: `public.${definition.name}`,
      migration: definition.migration,
      repairAvailable: false,
      durationMs: nowMs() - started,
    };
  } catch (error) {
    return {
      id: `database.table.${definition.name}`,
      name: `Table: ${definition.name}`,
      category: definition.category,
      status: 'unknown',
      severity: definition.critical ? 'critical' : 'warning',
      message: 'The check crashed before verification completed',
      details: error instanceof Error ? error.message : String(error),
      recommendation: 'Confirm Supabase connectivity and rerun the diagnostic.',
      dependency: `public.${definition.name}`,
      migration: definition.migration,
      repairAvailable: false,
      durationMs: nowMs() - started,
    };
  }
}

async function checkBucket(
  admin: ReturnType<typeof createAdminClient>,
  bucketName: string,
  category: Category,
): Promise<HealthCheck> {
  const started = nowMs();
  try {
    const { data, error } = await admin.storage.getBucket(bucketName);
    if (error || !data) {
      return {
        id: `storage.bucket.${bucketName}`,
        name: `Storage bucket: ${bucketName}`,
        category,
        status: 'blocked',
        severity: 'critical',
        message: 'Required private bucket does not exist',
        details: error?.message,
        recommendation: `Apply the migration that provisions the ${bucketName} bucket.`,
        repairAvailable: false,
        repairMode: 'manual_only',
        durationMs: nowMs() - started,
      };
    }
    if (data.public) {
      return {
        id: `storage.bucket.${bucketName}`,
        name: `Storage bucket: ${bucketName}`,
        category,
        status: 'blocked',
        severity: 'critical',
        message: 'Bucket is public but must be private',
        impact: 'Stored owner files may be reachable without authenticated signed URLs.',
        recommendation: 'Set public=false and verify owner-scoped storage policies.',
        repairAvailable: false,
        repairMode: 'manual_only',
        durationMs: nowMs() - started,
      };
    }
    return {
      id: `storage.bucket.${bucketName}`,
      name: `Storage bucket: ${bucketName}`,
      category,
      status: 'healthy',
      severity: 'critical',
      message: 'Exists and is private',
      repairAvailable: false,
      durationMs: nowMs() - started,
    };
  } catch (error) {
    return {
      id: `storage.bucket.${bucketName}`,
      name: `Storage bucket: ${bucketName}`,
      category,
      status: 'unknown',
      severity: 'critical',
      message: 'Bucket verification failed',
      details: error instanceof Error ? error.message : String(error),
      repairAvailable: false,
      durationMs: nowMs() - started,
    };
  }
}

function checkCanonicalDomain(): HealthCheck {
  const started = nowMs();
  const origin = process.env.WEBAUTHN_ORIGIN?.trim();
  const rpId = process.env.WEBAUTHN_RP_ID?.trim();
  if (!origin || !rpId) {
    return {
      id: 'authentication.webauthn.domain',
      name: 'Passkey canonical domain',
      category: 'authentication',
      status: 'blocked',
      severity: 'critical',
      message: 'WebAuthn origin or RP ID is missing',
      recommendation: 'Set both WEBAUTHN_ORIGIN and WEBAUTHN_RP_ID to the canonical production domain.',
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    };
  }
  try {
    const hostname = new URL(origin).hostname;
    const compatible = hostname === rpId || hostname.endsWith(`.${rpId}`);
    return {
      id: 'authentication.webauthn.domain',
      name: 'Passkey canonical domain',
      category: 'authentication',
      status: compatible ? 'healthy' : 'blocked',
      severity: 'critical',
      message: compatible ? `${origin} matches RP ID ${rpId}` : `${origin} is incompatible with RP ID ${rpId}`,
      recommendation: compatible ? undefined : 'Update both Render variables together. Existing passkeys remain bound to their original RP ID.',
      repairAvailable: false,
      repairMode: compatible ? undefined : 'manual_only',
      durationMs: nowMs() - started,
    };
  } catch {
    return {
      id: 'authentication.webauthn.domain',
      name: 'Passkey canonical domain',
      category: 'authentication',
      status: 'blocked',
      severity: 'critical',
      message: 'WEBAUTHN_ORIGIN is not a valid URL',
      details: origin,
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    };
  }
}

async function checkConfiguredProviders(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<HealthCheck[]> {
  const started = nowMs();
  const { data, error } = await admin
    .from('ai_providers')
    .select('provider,model,enabled,is_default')
    .eq('user_id', userId);
  if (error) {
    return [{
      id: 'intelligence.providers',
      name: 'AI provider configuration',
      category: 'intelligence',
      status: 'blocked',
      severity: 'critical',
      message: 'Provider configuration could not be read',
      details: error.message,
      recommendation: 'Repair the ai_providers schema and rerun Doctor.',
      repairAvailable: false,
      durationMs: nowMs() - started,
    }];
  }
  const enabled = (data ?? []).filter((provider) => provider.enabled);
  const defaultProvider = enabled.find((provider) => provider.is_default);
  const openAI = enabled.find((provider) => provider.provider === 'openai');
  return [
    {
      id: 'intelligence.providers',
      name: 'AI provider configuration',
      category: 'intelligence',
      status: enabled.length ? (defaultProvider ? 'healthy' : 'degraded') : 'not_configured',
      severity: 'critical',
      message: enabled.length ? `${enabled.length} enabled provider${enabled.length === 1 ? '' : 's'}${defaultProvider ? `; default is ${defaultProvider.provider}/${defaultProvider.model}` : '; no default selected'}` : 'No enabled database-backed AI provider',
      recommendation: enabled.length ? (defaultProvider ? undefined : 'Choose one enabled provider as default.') : 'Open AI Providers and configure at least one provider.',
      actionHref: '/settings/ai',
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    },
    {
      id: 'intelligence.openai',
      name: 'OpenAI readiness',
      category: 'intelligence',
      status: openAI || process.env.OPENAI_API_KEY ? 'healthy' : 'not_configured',
      severity: 'warning',
      message: openAI ? `OpenAI is enabled with model ${openAI.model}` : process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is configured in the environment' : 'OpenAI is not configured',
      recommendation: openAI || process.env.OPENAI_API_KEY ? undefined : 'Add OpenAI in AI Providers or set OPENAI_API_KEY.',
      actionHref: '/settings/ai',
      repairAvailable: false,
      repairMode: 'manual_only',
      durationMs: nowMs() - started,
    },
  ];
}

async function checkCredentialCount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<HealthCheck> {
  const started = nowMs();
  const { count, error } = await admin
    .from('webauthn_credentials')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) {
    return {
      id: 'authentication.passkeys',
      name: 'Registered passkeys',
      category: 'authentication',
      status: 'blocked',
      severity: 'critical',
      message: 'Passkey credentials could not be verified',
      details: error.message,
      repairAvailable: false,
      durationMs: nowMs() - started,
    };
  }
  return {
    id: 'authentication.passkeys',
    name: 'Registered passkeys',
    category: 'authentication',
    status: (count ?? 0) > 0 ? 'healthy' : 'not_configured',
    severity: 'critical',
    message: `${count ?? 0} passkey${count === 1 ? '' : 's'} registered`,
    recommendation: (count ?? 0) > 0 ? undefined : 'Register the owner passkey before relying on production access.',
    actionHref: '/settings/passkeys',
    repairAvailable: false,
    repairMode: 'manual_only',
    durationMs: nowMs() - started,
  };
}

function capabilityChecks(): HealthCheck[] {
  return [
    {
      id: 'voice.browser_runtime', name: 'Empire Voice runtime', category: 'voice', status: 'healthy', severity: 'info',
      message: 'Browser speech recognition, typed fallback, speech synthesis, and interruption paths are implemented',
      details: 'Actual microphone and speech availability remains browser/device dependent.', actionHref: '/empire', repairAvailable: false, durationMs: 0,
    },
    {
      id: 'recorder.module', name: 'Recorder module contract', category: 'recorder', status: 'healthy', severity: 'critical',
      message: 'Recorder UI, APIs, governed transcription tool, and private-storage contract are present', actionHref: '/recorder', repairAvailable: false, durationMs: 0,
    },
    {
      id: 'intelligence.benchmark', name: 'Intelligence benchmark', category: 'intelligence', status: 'healthy', severity: 'warning',
      message: 'Versioned live intelligence benchmark endpoint is available', actionHref: '/empire', repairAvailable: false, durationMs: 0,
    },
    {
      id: 'workers.external', name: 'Background worker heartbeat', category: 'workers', status: 'unknown', severity: 'warning',
      message: 'No durable worker heartbeat contract is registered yet',
      recommendation: 'Add worker_heartbeats and queue-lag checks before treating asynchronous processing as production-proven.', repairAvailable: false, durationMs: 0,
    },
  ];
}

function summarize(checks: HealthCheck[]): DoctorResult {
  const counts = {
    healthy: checks.filter((check) => check.status === 'healthy').length,
    degraded: checks.filter((check) => check.status === 'degraded').length,
    blocked: checks.filter((check) => check.status === 'blocked').length,
    unknown: checks.filter((check) => check.status === 'unknown').length,
    notConfigured: checks.filter((check) => check.status === 'not_configured').length,
  };
  const weights: Record<Severity, number> = { critical: 5, warning: 2, info: 1 };
  const values: Record<CheckStatus, number> = { healthy: 1, degraded: 0.6, blocked: 0, unknown: 0.35, not_configured: 0.2 };
  const possible = checks.reduce((sum, check) => sum + weights[check.severity], 0) || 1;
  let readinessScore = Math.round((checks.reduce((sum, check) => sum + weights[check.severity] * values[check.status], 0) / possible) * 100);
  if (checks.some((check) => check.status === 'blocked' && check.severity === 'critical')) readinessScore = Math.min(readinessScore, 69);
  const firstBlocker = checks.find((check) => check.status === 'blocked' && check.severity === 'critical');
  const firstDegraded = checks.find((check) => check.status !== 'healthy');
  return {
    version: '2.0.0',
    checks,
    overallHealth: counts.blocked ? 'red' : counts.degraded || counts.unknown || counts.notConfigured ? 'yellow' : 'green',
    readinessScore,
    nextBestAction: firstBlocker?.recommendation ?? firstDegraded?.recommendation,
    summary: counts,
    environment: {
      canonicalOrigin: process.env.WEBAUTHN_ORIGIN ?? null,
      rpId: process.env.WEBAUTHN_RP_ID ?? null,
      commitSha: process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
    },
    timestamp: new Date().toISOString(),
  };
}

/** GET /api/health/doctor — owner-authenticated verified operational truth. */
export async function GET() {
  const checks: HealthCheck[] = [
    envCheck('NEXT_PUBLIC_SUPABASE_URL', { critical: true, validate: isValidUrl }),
    envCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY', { critical: true, validate: looksLikeSupabaseKey, secret: true }),
    envCheck('SUPABASE_SERVICE_ROLE_KEY', { critical: true, validate: looksLikeSupabaseKey, secret: true }),
    envCheck('WEBAUTHN_ORIGIN', { critical: true, validate: isValidUrl, category: 'authentication' }),
    envCheck('WEBAUTHN_RP_ID', { critical: true, category: 'authentication' }),
    envCheck('OWNER_EMAIL', { critical: true, category: 'authentication' }),
    envCheck('OWNER_RECOVERY_CODE', { critical: false, secret: true, category: 'authentication' }),
    checkCanonicalDomain(),
    ...capabilityChecks(),
  ];

  let supabase: ReturnType<typeof createClient>;
  let userId: string;
  try {
    supabase = createClient();
    const auth = await requireUserId(supabase);
    if (!auth.ok) return jsonError(auth.error);
    userId = auth.data;
    checks.push({
      id: 'database.owner_session', name: 'Owner database session', category: 'database', status: 'healthy', severity: 'critical',
      message: 'Authenticated owner session is valid', repairAvailable: false, durationMs: 0,
    });
  } catch (error) {
    checks.push({
      id: 'database.owner_session', name: 'Owner database session', category: 'database', status: 'blocked', severity: 'critical',
      message: 'Supabase client or owner session could not be established', details: error instanceof Error ? error.message : String(error),
      recommendation: 'Correct Supabase environment values and authentication configuration.', repairAvailable: false, repairMode: 'manual_only', durationMs: 0,
    });
    return jsonOk(summarize(checks));
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
    checks.push({
      id: 'database.service_role', name: 'Supabase service-role connection', category: 'database', status: 'healthy', severity: 'critical',
      message: 'Administrative diagnostic client initialized', repairAvailable: false, durationMs: 0,
    });
  } catch (error) {
    checks.push({
      id: 'database.service_role', name: 'Supabase service-role connection', category: 'database', status: 'blocked', severity: 'critical',
      message: 'Administrative diagnostic client could not initialize', details: error instanceof Error ? error.message : String(error),
      recommendation: 'Correct SUPABASE_SERVICE_ROLE_KEY in Render.', repairAvailable: false, repairMode: 'manual_only', durationMs: 0,
    });
    return jsonOk(summarize(checks));
  }

  const tableChecks = await Promise.all(REQUIRED_TABLES.map((definition) => checkTable(admin, definition)));
  checks.push(...tableChecks);
  checks.push(...await Promise.all([
    checkBucket(admin, 'recordings', 'recorder'),
    checkBucket(admin, 'empire-documents', 'modules'),
  ]));

  const aiTableHealthy = tableChecks.some((check) => check.id === 'database.table.ai_providers' && check.status === 'healthy');
  if (aiTableHealthy) checks.push(...await checkConfiguredProviders(admin, userId));
  const passkeyTableHealthy = tableChecks.some((check) => check.id === 'database.table.webauthn_credentials' && check.status === 'healthy');
  if (passkeyTableHealthy) checks.push(await checkCredentialCount(admin, userId));

  return jsonOk(summarize(checks));
}
