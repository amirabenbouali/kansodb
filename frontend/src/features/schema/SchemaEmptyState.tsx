import { AlertCircle, Database } from "lucide-react";

interface SchemaEmptyStateProps {
  message: string;
  tone?: "empty" | "error";
}

export function SchemaEmptyState({ message, tone = "empty" }: SchemaEmptyStateProps) {
  const Icon = tone === "error" ? AlertCircle : Database;

  return (
    <div className={`schema-empty-state is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
