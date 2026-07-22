import type { KansoErrorView } from "../execution/executionTypes";

interface ErrorMetadataProps {
  error: KansoErrorView;
}

export function ErrorMetadata({ error }: ErrorMetadataProps) {
  if (error.metadata === undefined) {
    return null;
  }

  const metadataEntries = Object.entries(error.metadata).filter(([, value]) => value !== undefined);
  if (metadataEntries.length === 0) {
    return null;
  }

  return (
    <dl className="error-metadata">
      {metadataEntries.map(([key, value]) => (
        <div key={key}>
          <dt>{humanizeKey(key)}</dt>
          <dd>{formatMetadataValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
}

function formatMetadataValue(value: unknown): string {
  if (value === null) {
    return "NULL";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
