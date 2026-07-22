import type { PersistenceCapabilitiesView } from "../../engine/KansoClient";

export function browserPersistenceLimitations(capabilities: PersistenceCapabilitiesView): string {
  if (capabilities.directFilePaths) {
    return "Native filesystem paths are available in this runtime.";
  }

  if (capabilities.fileSystemAccessApi) {
    return "Browser runtime: native paths are unavailable. File System Access can be used only after explicit browser permission; KansoDB currently uses browser-backed storage with import/export as the compatibility path.";
  }

  return "Browser runtime: native Node filesystem paths are unavailable. File-backed databases are stored through a browser-compatible adapter, with import/export as the compatibility path.";
}
