import { describe, expect, it } from "vitest";
import { defaultUiPreferences, loadUiPreferences, parseUiPreferences, saveUiPreferences } from "../../frontend/src/features/settings/uiPreferences.js";

class MemoryStorage implements Storage {
  public readonly data = new Map<string, string>();

  public get length(): number {
    return this.data.size;
  }

  public clear(): void {
    this.data.clear();
  }

  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.data.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("UI preferences storage", () => {
  it("falls back safely for malformed data", () => {
    const storage = new MemoryStorage();
    storage.setItem("kansodb.uiPreferences.v1", "not-json");

    expect(loadUiPreferences(storage)).toEqual(defaultUiPreferences);
  });

  it("bounds parsed editor preferences", () => {
    expect(parseUiPreferences({
      theme: "dim",
      editorFontSize: 99,
      editorWordWrap: true,
      reducedMotion: true,
      autoSaveMode: "after-mutation",
      rightPanelVisible: false,
      sidebarCollapsed: true,
      onboardingComplete: true
    })).toMatchObject({
      theme: "dim",
      editorFontSize: 20,
      editorWordWrap: true,
      reducedMotion: true,
      autoSaveMode: "after-mutation",
      rightPanelVisible: false,
      sidebarCollapsed: true,
      onboardingComplete: true
    });
  });

  it("saves and restores preferences", () => {
    const storage = new MemoryStorage();
    saveUiPreferences({ ...defaultUiPreferences, editorFontSize: 16, onboardingComplete: true }, storage);

    expect(loadUiPreferences(storage)).toMatchObject({
      editorFontSize: 16,
      onboardingComplete: true
    });
  });
});
