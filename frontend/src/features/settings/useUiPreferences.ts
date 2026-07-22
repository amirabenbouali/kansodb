import { useCallback, useEffect, useState } from "react";
import { defaultUiPreferences, loadUiPreferences, saveUiPreferences, type UiPreferences } from "./uiPreferences";

export function useUiPreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(() => loadUiPreferences());

  useEffect(() => {
    saveUiPreferences(preferences);
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.reducedMotion = preferences.reducedMotion ? "true" : "false";
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<UiPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultUiPreferences);
  }, []);

  return { preferences, resetPreferences, updatePreferences };
}
