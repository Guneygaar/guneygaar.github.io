// Supabase Edge Function: align-plan
// Runs the full alignment transaction when a Client taps "Align month".
//
// Inputs (POST JSON body):
//   { plan_id, client_user_id, client_name, workspace_id }
//
// Steps (single transaction via Postgres RPC `align_plan_transaction`):
//   1. Snapshot current plan_cells into plan_versions (version_number = current + 1, trigger_event 'aligned')
//   2. UPDATE plans SET plan_status='aligned', current_version+=1, aligned_version=current_version, aligned_at=now(), aligned_by, updated_at=now()
//   3. Spawn posts from non-spawned plan_cells (post_id = 'post_' || substring(uuid,1,8), stage='brief', owner='Servicing')
//   4. Mark inserted cells as cell_status='spawned'
//   5. Insert ONE plan-level notification to Servicing
//
// Returns: { success: true, spawned_count: N, version: V }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AlignPayload {
  plan_id: string;
  client_user_id: string;
  client_name: string;
  workspace_id: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body: AlignPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { plan_id, client_user_id, client_name, workspace_id } = body || ({} as AlignPayload);
  if (!plan_id || !client_user_id || !client_name || !workspace_id) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data, error } = await admin.rpc('align_plan_transaction', {
      p_plan_id: plan_id,
      p_client_user_id: client_user_id,
      p_client_name: client_name,
      p_workspace_id: workspace_id
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({
      success: true,
      spawned_count: row?.spawned_count ?? 0,
      version: row?.new_version ?? null
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'align_failed', detail: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
