export type AppLanguage = "English" | "Filipino";

export type UserPreferences = {
  language: AppLanguage;
  font_size: "default" | "large" | "x-large";
  contrast_mode: "normal" | "high";
  dark_mode: boolean;
  sound_enabled: boolean;
  volume_level: number;
  brightness_level: number;
  sfx_level: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: "English",
  font_size: "default",
  contrast_mode: "normal",
  dark_mode: false,
  sound_enabled: true,
  volume_level: 80,
  brightness_level: 50,
  sfx_level: 80,
};

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === "Filipino" ? "Filipino" : "English";
}

export function normalizePreferencesRow(row: Partial<UserPreferences> | null | undefined): UserPreferences {
  if (!row) {
    return DEFAULT_PREFERENCES;
  }

  return {
    language: normalizeLanguage(row.language),
    font_size:
      row.font_size === "large" || row.font_size === "x-large"
        ? row.font_size
        : DEFAULT_PREFERENCES.font_size,
    contrast_mode: row.contrast_mode === "high" ? "high" : "normal",
    dark_mode: row.dark_mode ?? DEFAULT_PREFERENCES.dark_mode,
    sound_enabled: row.sound_enabled ?? DEFAULT_PREFERENCES.sound_enabled,
    volume_level: clampLevel(row.volume_level ?? DEFAULT_PREFERENCES.volume_level),
    brightness_level: clampLevel(row.brightness_level ?? DEFAULT_PREFERENCES.brightness_level),
    sfx_level: clampLevel(row.sfx_level ?? DEFAULT_PREFERENCES.sfx_level),
  };
}

export function getBaseFontSizeClass(value: UserPreferences["font_size"]): string {
  if (value === "x-large") {
    return "text-lg";
  }

  if (value === "large") {
    return "text-base";
  }

  return "text-sm";
}

export function getBrightnessMultiplier(level: number): number {
  return 0.5 + clampLevel(level) / 100;
}

export function getSoundGain(preferences: UserPreferences): number {
  if (!preferences.sound_enabled) {
    return 0;
  }

  return (clampLevel(preferences.volume_level) / 100) * (clampLevel(preferences.sfx_level) / 100);
}
