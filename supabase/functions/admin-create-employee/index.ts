// Edge function: Manager creates a new employee account.
// Auth required: caller must be a manager. Verifies via JWT against the user_roles table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Body { email: string; password: string; full_name: string; phone?: string; role?: "employee" | "manager"; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is a manager
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json(401, { error: "Invalid session" });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "manager")
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Only managers can create staff accounts" });

    const body = (await req.json()) as Body;
    const role = body.role === "manager" ? "manager" : "employee";

    if (!body.email || !body.password || !body.full_name) {
      return json(400, { error: "email, password and full_name are required" });
    }
    if (body.password.length < 6) return json(400, { error: "Password must be at least 6 characters" });

    // Check existing
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === body.email);
    if (existing) return json(409, { error: "An account with this email already exists" });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, phone: body.phone ?? null, role },
    });
    if (createErr || !created.user) return json(500, { error: createErr?.message ?? "Create failed" });

    await admin.from("profiles").upsert(
      { user_id: created.user.id, full_name: body.full_name, phone: body.phone ?? null },
      { onConflict: "user_id" }
    );
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    await admin.from("user_roles").insert({ user_id: created.user.id, role });

    return json(200, { success: true, user_id: created.user.id });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
