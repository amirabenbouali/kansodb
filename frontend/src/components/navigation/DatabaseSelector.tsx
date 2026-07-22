import { ChevronDown } from "lucide-react";

interface DatabaseSelectorProps {
  databaseName: string;
}

export function DatabaseSelector({ databaseName }: DatabaseSelectorProps) {
  return (
    <button className="database-selector" type="button" aria-label={`Current database: ${databaseName}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="database-copy">{databaseName}</span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
  );
}
