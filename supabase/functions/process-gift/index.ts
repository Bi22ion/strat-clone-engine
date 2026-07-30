// Supabase Edge Function (Deno) - process a gift atomically using service role key
// This is a skeleton: deploy via `supabase functions deploy process-gift`

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const InputSchema = z.object({
  pk_session_id: z.string().uuid().optional(),
  from_user_id: z.string().uuid(),
  to_host_id: z.string().uuid(),
  tokens_amount: z.number().int().positive(), // tokens spent by viewer
  org_id: z.string().uuid().nullable().optional(), // optional agency/org for the host
});

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing_env" }, { status: 500 });

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });

  const { pk_session_id, from_user_id, to_host_id, tokens_amount, org_id } = parsed.data;

  // Use a SQL RPC for full atomicity (recommended). For now, do a single SQL statement via `rpc`.
  // We'll call a function `process_gift` created in a later migration.
  const { data, error } = await supabase.rpc("process_gift", {
    p_pk_session_id: pk_session_id ?? null,
    p_from_user_id: from_user_id,
    p_to_host_id: to_host_id,
    p_tokens_amount: tokens_amount,
    p_org_id: org_id ?? null,
  });

  if (error) return json({ error: "rpc_failed", details: error.message }, { status: 400 });
  return json({ ok: true, result: data });
});

