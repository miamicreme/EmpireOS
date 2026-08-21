import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/security';
import { jsonError, jsonOk } from '@/lib/api';
import { appError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { routeId: string } }) {
  const supabase = createClient();
  const auth = await requireUserId(supabase);
  if (!auth.ok) return jsonError(auth.error);

  const { data: route, error } = await supabase
    .from('empire_document_routes')
    .select('id,document_id,destination_module,target_entity_type,status')
    .eq('id', params.routeId)
    .eq('user_id', auth.data)
    .maybeSingle();

  if (error) return jsonError(appError('db_error', 'Could not load the routing proposal.'));
  if (!route) return jsonError(appError('not_found', 'Routing proposal not found.'));
  if (route.status === 'rejected') return jsonError(appError('invalid_state', 'A rejected route cannot be approved.'));

  const now = new Date().toISOString();
  const updated = await supabase
    .from('empire_document_routes')
    .update({ status: 'completed', approved_at: now, updated_at: now })
    .eq('id', route.id)
    .eq('user_id', auth.data);
  if (updated.error) return jsonError(appError('db_error', 'Could not approve document routing.'));

  await supabase.from('empire_document_links').upsert({
    document_id: route.document_id,
    user_id: auth.data,
    target_module: route.destination_module,
    target_entity_type: route.target_entity_type ?? 'document',
    target_entity_id: route.document_id,
    relationship: 'filed_in',
  }, { onConflict: 'document_id,target_module,target_entity_type,target_entity_id' });

  await supabase
    .from('empire_documents')
    .update({ status: 'routed', updated_at: now })
    .eq('id', route.document_id)
    .eq('user_id', auth.data);

  return jsonOk({
    routeId: route.id,
    documentId: route.document_id,
    destinationModule: route.destination_module,
    status: 'completed',
  });
}
