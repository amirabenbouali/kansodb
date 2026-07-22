import { Activity, Clock3, Database, ListTree } from "lucide-react";
import type { ReactNode } from "react";
import type { ExecutionOperatorView } from "../../engine/tracing/traceTypes";
import type { QueryTabExecutionSnapshot } from "../execution/executionTypes";
import { EngineInspector } from "../engine-inspector/EngineInspector";

interface EngineViewProps {
  execution: QueryTabExecutionSnapshot | null | undefined;
  running: boolean;
  onSelectSqlRange: (range: { start: number; end: number } | null) => void;
}

export function EngineView({ execution, running, onSelectSqlRange }: EngineViewProps) {
  const trace = execution?.trace ?? null;
  const statusLabel = running ? "Running" : execution?.status === "error" ? "Failed" : execution?.status === "success" ? "Ready" : "Waiting";
  const completedStages = trace?.stages.filter((stage) => stage.status === "complete").length ?? 0;
  const failedStages = trace?.stages.filter((stage) => stage.status === "failed").length ?? 0;
  const durationMs = execution?.executionTimeMs;
  const operatorCount = countOperators(trace?.operators);

  return (
    <section className="engine-view" aria-label="Engine trace">
      <div className="engine-view-summary" aria-label="Engine trace summary">
        <Metric icon={<Activity size={13} aria-hidden="true" />} label="State" value={statusLabel} tone={execution?.status === "error" ? "error" : running ? "active" : "neutral"} />
        <Metric icon={<ListTree size={13} aria-hidden="true" />} label="Stages" value={trace === null ? "No trace" : `${completedStages}/${trace.stages.length}${failedStages > 0 ? " failed" : ""}`} />
        <Metric icon={<Clock3 size={13} aria-hidden="true" />} label="Duration" value={durationMs === null || durationMs === undefined ? "-" : `${durationMs.toFixed(1)} ms`} />
        <Metric icon={<Database size={13} aria-hidden="true" />} label="Operators" value={operatorCount === 0 ? "-" : String(operatorCount)} />
      </div>
      <EngineInspector
        error={execution?.error ?? null}
        trace={trace}
        onSelectSqlRange={onSelectSqlRange}
      />
    </section>
  );
}

function Metric({
  icon,
  label,
  tone = "neutral",
  value
}: {
  icon: ReactNode;
  label: string;
  tone?: "active" | "error" | "neutral";
  value: string;
}) {
  return (
    <div className={`engine-view-metric is-${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function countOperators(operators: readonly ExecutionOperatorView[] | undefined): number {
  if (!Array.isArray(operators)) {
    return 0;
  }

  return operators.reduce((total, operator) => total + 1 + countOperators(operator.children), 0);
}
