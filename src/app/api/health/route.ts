import { NextResponse } from 'next/server';
import { hasAnyAiProvider } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      service: 'empire-os-backend',
      status: 'healthy',
      aiProviderConfigured: hasAnyAiProvider(),
    },
  });
}
