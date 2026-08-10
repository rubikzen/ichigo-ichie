import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabase/admin";

export async function requireAdmin(request: Request): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw Object.assign(new Error("AUTH_REQUIRED"), { status: 401 });
  const supabase = createServiceSupabase();
  if (!supabase) throw Object.assign(new Error("SUPABASE_NOT_CONFIGURED"), { status: 503 });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw Object.assign(new Error("AUTH_INVALID"), { status: 401 });
  const { data: admin, error: adminError } = await supabase.from("admins").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (adminError || !admin) throw Object.assign(new Error("ADMIN_REQUIRED"), { status: 403 });
  return { supabase, userId: userData.user.id };
}
