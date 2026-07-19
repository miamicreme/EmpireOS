import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonResult } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface DoctorResult {
  checks: HealthCheck[];
  overallHealth: 'green' | 'yellow' | 'red';
  timestamp: string;
}

async function checkTable(supabase: ReturnType<typeof createClient>, tableName: string): Promise<HealthCheck> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        name: `Table: ${tableName}`,
        status: 'error',
        message: `Table does not exist or is inaccessible`,
        details: error.message,
      };
    }

    return {
      name: `Table: ${tableName}`,
      status: 'ok',
      message: `Table exists`,
    };
  } catch (err) {
    return {
      name: `Table: ${tableName}`,
      status: 'error',
      message: 'Failed to check table',
      details: String(err),
    };
  }
}

async function checkStorageBucket(supabase: ReturnType<typeof createClient>, bucketName: string): Promise<HealthCheck> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (error || !data) {
      return {
        name: `Storage bucket: ${bucketName}`,
        status: 'error',
        message: 'Bucket does not exist',
        details: error?.message,
      };
    }

    return {
      name: `Storage bucket: ${bucketName}`,
      status: 'ok',
      message: `Bucket exists (public: ${data.public})`,
    };
  } catch (err) {
    return {
      name: `Storage bucket: ${bucketName}`,
      status: 'error',
      message: 'Failed to check bucket',
      details: String(err),
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheck[]> {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  return required.map((envVar) => ({
    name: `Environment: ${envVar}`,
    status: process.env[envVar] ? 'ok' : 'error',
    message: process.env[envVar] ? 'Configured' : 'Missing',
  }));
}

/** GET /api/health/doctor — comprehensive system health check. */
export async function GET() {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const checks: HealthCheck[] = [];

  // Check critical tables
  const criticalTables = ['recordings', 'actions', 'artifacts', 'global_actions', 'ai_providers', 'auth_passkeys'];
  for (const table of criticalTables) {
    checks.push(await checkTable(supabase, table));
  }

  // Check storage buckets
  const buckets = ['recordings'];
  for (const bucket of buckets) {
    checks.push(await checkStorageBucket(supabase, bucket));
  }

  // Check environment variables
  checks.push(...await checkEnvironmentVariables());

  // Determine overall health
  const errors = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warning').length;

  const overallHealth = errors > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green';

  const result: DoctorResult = {
    checks,
    overallHealth,
    timestamp: new Date().toISOString(),
  };

  return jsonResult(result);
}
