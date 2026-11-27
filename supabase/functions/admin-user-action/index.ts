import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in required." }, 401);
    const token = authHeader.slice(7);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (!url || !anonKey || !serviceKey) return json({ error: "Supabase server keys are not configured." }, 500);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session." }, 401);
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "claim_owner") {
      const claimCode = String(body.code ?? "").trim();
      if (claimCode.length < 20 || claimCode.length > 120) return json({ error: "Invalid owner activation code." }, 400);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(claimCode));
      const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const { data: claimed, error: claimError } = await caller.rpc("claim_dreambig_owner", { p_token_hash: tokenHash });
      if (claimError || claimed !== true) return json({ error: claimError?.message || "Owner activation failed." }, 400);
      return json({ ok: true, message: "Owner access activated. Your username is now @owner." });
    }

    const { data: adminFlag, error: adminError } = await caller.rpc("is_dreambig_admin");
    if (adminError || adminFlag !== true) return json({ error: "Admin access required." }, 403);
    const targetId = String(body.userId ?? "");
    const reason = String(body.reason ?? "").trim().slice(0, 240);
    if (!targetId) return json({ error: "Target user is required." }, 400);
    if (targetId === authData.user.id && ["ban", "delete"].includes(action)) return json({ error: "You cannot ban or delete your own admin account." }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: target, error: targetError } = await admin.from("profiles").select("id,username").eq("id", targetId).maybeSingle();
    if (targetError || !target) return json({ error: "User not found." }, 404);

    if (action === "delete") {
      const { data: roles } = await admin.from("dreambig_admins").select("user_id").eq("user_id", targetId).maybeSingle();
      if (roles) return json({ error: "Admin accounts cannot be deleted from this panel." }, 403);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, message: `@${target.username} account deleted.` });
    }
    if (action === "ban" || action === "unban") {
      const banned = action === "ban";
      const { error: profileError } = await admin.from("profiles").update({
        is_banned: banned, ban_reason: banned ? (reason || "Community guidelines violation") : null, banned_until: null,
      }).eq("id", targetId);
      if (profileError) return json({ error: profileError.message }, 400);
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: banned ? "876000h" : "none" });
      if (authUpdateError) {
        await admin.from("profiles").update({ is_banned: !banned, ban_reason: null }).eq("id", targetId);
        return json({ error: authUpdateError.message }, 400);
      }
      return json({ ok: true, message: banned ? `@${target.username} has been banned.` : `@${target.username} has been unbanned.` });
    }
    const changes: Record<string, boolean> = {};
    if (action === "verify") changes.is_verified = true;
    else if (action === "unverify") changes.is_verified = false;
    else if (action === "make_private") changes.is_private = true;
    else if (action === "make_public") changes.is_private = false;
    else return json({ error: "Unsupported admin action." }, 400);
    const { error } = await admin.from("profiles").update(changes).eq("id", targetId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, message: `@${target.username} updated.` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
  }
});