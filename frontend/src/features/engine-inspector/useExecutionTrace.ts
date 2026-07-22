import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExecutionTrace, ExecutionTraceStageId, TokenTraceView } from "../../engine/tracing/traceTypes";
import { TRACE_STAGE_ORDER } from "../../engine/tracing/traceTypes";

interface UseExecutionTraceResult {
  selectedStageId: ExecutionTraceStageId;
  selectedToken: TokenTraceView | null;
  selectNextStage: () => void;
  selectPreviousStage: () => void;
  setSelectedStageId: (stageId: ExecutionTraceStageId) => void;
  setSelectedToken: (token: TokenTraceView | null) => void;
}

export function useExecutionTrace(trace: ExecutionTrace | null): UseExecutionTraceResult {
  const [selectedStageId, setSelectedStageId] = useState<ExecutionTraceStageId>("results");
  const [selectedToken, setSelectedToken] = useState<TokenTraceView | null>(null);

  const availableStageIds = useMemo(
    () => trace?.stages.map((stage) => stage.id) ?? [...TRACE_STAGE_ORDER],
    [trace]
  );

  useEffect(() => {
    if (trace === null) {
      setSelectedStageId("results");
      setSelectedToken(null);
      return;
    }

    const failedStage = trace.stages.find((stage) => stage.status === "failed");
    setSelectedStageId(failedStage?.id ?? "results");
  }, [trace]);

  const moveStage = useCallback((direction: -1 | 1) => {
    setSelectedStageId((currentStageId) => {
      const currentIndex = availableStageIds.indexOf(currentStageId);
      const nextIndex = currentIndex === -1 ? 0 : Math.min(Math.max(currentIndex + direction, 0), availableStageIds.length - 1);
      return availableStageIds[nextIndex] ?? currentStageId;
    });
  }, [availableStageIds]);

  return {
    selectedStageId,
    selectedToken,
    selectNextStage: () => moveStage(1),
    selectPreviousStage: () => moveStage(-1),
    setSelectedStageId,
    setSelectedToken
  };
}
