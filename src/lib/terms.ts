import type { SupabaseClient } from "@supabase/supabase-js";
import { siteSettingDefaults } from "@/lib/settings";

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export async function getTermsVersion(supabase: SupabaseClient) {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "terms_version")
      .maybeSingle();
    if (!error) {
      const value = textValue(data?.value);
      if (value) return value.slice(0, 80);
    }
  } catch (error) {
    console.error("Terms version lookup failed", error);
  }

  return (
    process.env.TERMS_VERSION?.trim()
    || siteSettingDefaults.terms_version
    || "2026-08-12-v1"
  ).slice(0, 80);
}
