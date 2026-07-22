import type { KeyboardEvent } from "react";
import type { ExecutionTrace, ExecutionTraceStageId } from "../../engine/tracing/traceTypes";
import { PipelineStage } from "./PipelineStage";

interface ExecutionPipelineProps {
  selectedStageId: ExecutionTraceStageId;
  trace: ExecutionTrace;
  onNextStage: () => void;
  onPreviousStage: () => void;
  onSelectStage: (stageId: ExecutionTraceStageId) => void;
}

export function ExecutionPipeline({
  selectedStageId,
  trace,
  onNextStage,
  onPreviousStage,
  onSelectStage
}: ExecutionPipelineProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onNextStage();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPreviousStage();
    }
  };

  return (
    <section className="trace-pipeline" role="tablist" aria-label="Execution trace stages" onKeyDown={handleKeyDown}>
      {trace.stages.map((stage) => (
        <PipelineStage
          key={stage.id}
          selected={stage.id === selectedStageId}
          stage={stage}
          onSelect={onSelectStage}
        />
      ))}
    </section>
  );
}
