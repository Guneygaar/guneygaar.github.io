// Supabase Edge Function: send-plan-alignment
// Snapshots current plan state, bumps current_version, marks plan
// awaiting_alignment, and notifies the Client. Single Postgres RPC
// keeps the work atomic.
//
// Inputs (POST JSON body):
//   { plan_id, user_id, user_name, user_role, workspace_id }
//
// Returns: { success: true, version: N }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface SendPayload {
  plan_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
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

  let body: SendPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { plan_id, user_id, user_name, user_role, workspace_id } = body || ({} as SendPayload);
  if (!plan_id || !user_name || !user_role || !workspace_id) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data, error } = await admin.rpc('send_plan_for_alignment_transaction', {
      p_plan_id: plan_id,
      p_user_id: user_id || null,
      p_user_name: user_name,
      p_user_role: user_role,
      p_workspace_id: workspace_id
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({
      success: true,
      version: row?.new_version ?? null
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'send_failed', detail: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
