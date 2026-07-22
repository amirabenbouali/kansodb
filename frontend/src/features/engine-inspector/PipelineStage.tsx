import { Check, Minus, X } from "lucide-react";
import type { ExecutionTraceStage, ExecutionTraceStageId } from "../../engine/tracing/traceTypes";

interface PipelineStageProps {
  selected: boolean;
  stage: ExecutionTraceStage;
  onSelect: (stageId: ExecutionTraceStageId) => void;
}

const stageLabels: Record<ExecutionTraceStageId, string> = {
  sql: "SQL",
  lexer: "Lexer",
  parser: "Parser",
  ast: "AST",
  executor: "Executor",
  storage: "Storage",
  results: "Results"
};

export function PipelineStage({ selected, stage, onSelect }: PipelineStageProps) {
  return (
    <button
      className={selected ? `trace-stage is-${stage.status} is-selected` : `trace-stage is-${stage.status}`}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(stage.id)}
    >
      <span>{stageLabels[stage.id]}</span>
      <small>{stage.durationMs === undefined ? stage.summary ?? stage.status : `${stage.durationMs.toFixed(1)} ms`}</small>
      <i className={`stage-dot is-${stage.status}`}>
        {stage.status === "complete" ? <Check size={15} aria-hidden="true" /> : null}
        {stage.status === "failed" ? <X size={15} aria-hidden="true" /> : null}
        {stage.status === "skipped" ? <Minus size={15} aria-hidden="true" /> : null}
      </i>
    </button>
  );
}
