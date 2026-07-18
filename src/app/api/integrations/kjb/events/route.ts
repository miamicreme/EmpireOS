import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const eventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1).max(120),
  source: z.literal('kjb-personal'),
  version: z.string().min(1).max(20).default('1.0'),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
});

function authorized(request: NextRequest): boolean {
  const expected = process.env.KJB_INGEST_TOKEN;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(expected && provided && provided === expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerUserId = process.env.OWNER_USER_ID;
  if (!ownerUserId) {
    return NextResponse.json({ error: 'OWNER_USER_ID is not configured' }, { status: 503 });
  }

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event', details: parsed.error.flatten() }, { status: 400 });
  }

  const event = parsed.data;
  const supabase = createAdminClient();
  const status = event.eventType.endsWith('.failed') ? 'failed' : event.eventType.endsWith('.published') ? 'published' : 'processing';
  const { error } = await supabase.from('content_runs').upsert({
    id: event.eventId,
    user_id: ownerUserId,
    source: event.source,
    event_type: event.eventType,
    version: event.version,
    correlation_id: event.correlationId ?? null,
    status,
    title: typeof event.payload.title === 'string' ? event.payload.title : null,
    article_id: typeof event.payload.articleId === 'string' ? event.payload.articleId : null,
    channel: typeof event.payload.channel === 'string' ? event.payload.channel : null,
    payload: event.payload,
    occurred_at: event.occurredAt,
    received_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) {
    return NextResponse.json({ error: 'Failed to persist event' }, { status: 500 });
  }

  return NextResponse.json({ accepted: true, eventId: event.eventId }, { status: 202 });
}
