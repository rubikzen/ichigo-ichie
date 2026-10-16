export type ChristmasIntensity = "soft" | "festive" | "full";

export function christmasIntensity(value: string | undefined): ChristmasIntensity {
  return value === "soft" || value === "full" ? value : "festive";
}

export function christmasOptions(settings: Record<string, string | undefined>) {
  const enabled = settings.theme_christmas_enabled === "true";
  const intensity = christmasIntensity(settings.theme_christmas_intensity);
  return {
    enabled,
    intensity,
    snow: enabled && intensity !== "soft" && settings.theme_christmas_snow_enabled !== "false",
    decor: enabled && settings.theme_christmas_decor_enabled !== "false",
  };
}
