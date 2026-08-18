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


export async function requirePickupStaff(
  request: Request
): Promise<{
  supabase: SupabaseClient;
  userId: string;
  access: "admin" | "pickup_staff";
}> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    throw Object.assign(new Error("AUTH_REQUIRED"), { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    throw Object.assign(new Error("SUPABASE_NOT_CONFIGURED"), { status: 503 });
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw Object.assign(new Error("AUTH_INVALID"), { status: 401 });
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    throw Object.assign(new Error("ADMIN_ACCESS_LOOKUP_FAILED"), {
      status: 503,
    });
  }

  if (admin) {
    return {
      supabase,
      userId: userData.user.id,
      access: "admin",
    };
  }

  const { data: staff, error: staffError } = await supabase
    .from("pickup_staff")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (staffError) {
    throw Object.assign(new Error("PICKUP_STAFF_NOT_CONFIGURED"), {
      status: 503,
    });
  }

  if (!staff) {
    throw Object.assign(new Error("PICKUP_STAFF_REQUIRED"), { status: 403 });
  }

  return {
    supabase,
    userId: userData.user.id,
    access: "pickup_staff",
  };
}
