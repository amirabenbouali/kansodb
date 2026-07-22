export type AutoSaveModePreference = "off" | "on-commit" | "after-mutation";
export type ThemePreference = "dark" | "dim";

export interface UiPreferences {
  theme: ThemePreference;
  editorFontSize: number;
  editorWordWrap: boolean;
  reducedMotion: boolean;
  autoSaveMode: AutoSaveModePreference;
  rightPanelVisible: boolean;
  sidebarCollapsed: boolean;
  onboardingComplete: boolean;
}

export const defaultUiPreferences: UiPreferences = {
  theme: "dark",
  editorFontSize: 13,
  editorWordWrap: false,
  reducedMotion: false,
  autoSaveMode: "off",
  rightPanelVisible: true,
  sidebarCollapsed: false,
  onboardingComplete: false
};

const STORAGE_KEY = "kansodb.uiPreferences.v1";

export function loadUiPreferences(storage: Storage | undefined = safeStorage()): UiPreferences {
  if (storage === undefined) {
    return defaultUiPreferences;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return defaultUiPreferences;
    }

    return parseUiPreferences(JSON.parse(raw));
  } catch {
    return defaultUiPreferences;
  }
}

export function saveUiPreferences(preferences: UiPreferences, storage: Storage | undefined = safeStorage()): void {
  if (storage === undefined) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function parseUiPreferences(value: unknown): UiPreferences {
  if (typeof value !== "object" || value === null) {
    return defaultUiPreferences;
  }

  const candidate = value as Record<string, unknown>;

  return {
    theme: candidate.theme === "dim" ? "dim" : "dark",
    editorFontSize: boundedNumber(candidate.editorFontSize, 12, 20, defaultUiPreferences.editorFontSize),
    editorWordWrap: typeof candidate.editorWordWrap === "boolean" ? candidate.editorWordWrap : defaultUiPreferences.editorWordWrap,
    reducedMotion: typeof candidate.reducedMotion === "boolean" ? candidate.reducedMotion : defaultUiPreferences.reducedMotion,
    autoSaveMode: parseAutoSaveMode(candidate.autoSaveMode),
    rightPanelVisible: typeof candidate.rightPanelVisible === "boolean" ? candidate.rightPanelVisible : defaultUiPreferences.rightPanelVisible,
    sidebarCollapsed: typeof candidate.sidebarCollapsed === "boolean" ? candidate.sidebarCollapsed : defaultUiPreferences.sidebarCollapsed,
    onboardingComplete: typeof candidate.onboardingComplete === "boolean" ? candidate.onboardingComplete : defaultUiPreferences.onboardingComplete
  };
}

function parseAutoSaveMode(value: unknown): AutoSaveModePreference {
  return value === "on-commit" || value === "after-mutation" ? value : "off";
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function safeStorage(): Storage | undefined {
  const candidate = globalThis as { localStorage?: Storage };
  return candidate.localStorage;
}
