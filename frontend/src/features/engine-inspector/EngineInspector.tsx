import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import type { ExecutionTrace, ExecutionTraceStageId, TokenTraceView } from "../../engine/tracing/traceTypes";
import type { KansoErrorView } from "../execution/executionTypes";
import { ExecutionError } from "../execution/ExecutionError";
import { AstInspector } from "./AstInspector";
import { ExecutionPipeline } from "./ExecutionPipeline";
import { OperatorTree } from "./OperatorTree";
import { ResultInspector } from "./ResultInspector";
import { StorageInspector } from "./StorageInspector";
import { TokenInspector } from "./TokenInspector";
import { useExecutionTrace } from "./useExecutionTrace";

interface EngineInspectorProps {
  error: KansoErrorView | null;
  trace: ExecutionTrace | null;
  onSelectSqlRange: (range: { start: number; end: number } | null) => void;
}

export function EngineInspector({ error, trace, onSelectSqlRange }: EngineInspectorProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    selectedStageId,
    selectedToken,
    selectNextStage,
    selectPreviousStage,
    setSelectedStageId,
    setSelectedToken
  } = useExecutionTrace(trace);

  const selectToken = (token: TokenTraceView) => {
    setSelectedToken(token);
    onSelectSqlRange(token.start === token.end ? null : { start: token.start, end: token.end });
  };

  if (trace === null) {
    return (
      <>
        <section className="trace-pipeline is-empty" aria-label="Execution trace stages">
          {["SQL", "Lexer", "Parser", "AST", "Executor", "Storage", "Results"].map((label) => (
            <div className="trace-stage is-skipped" key={label}>
              <span>{label}</span>
              <small>Waiting</small>
              <i className="stage-dot is-skipped" />
            </div>
          ))}
        </section>
        <section className="engine-inspector is-empty">
          <p className="trace-note">Execute SQL to inspect how KansoDB processed it.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <ExecutionPipeline
        selectedStageId={selectedStageId}
        trace={trace}
        onNextStage={selectNextStage}
        onPreviousStage={selectPreviousStage}
        onSelectStage={setSelectedStageId}
      />
      <section className={expanded ? "engine-inspector is-expanded" : "engine-inspector"}>
        <aside className="trace-stage-list">
          <div className="section-heading">
            <h2>Execution Inspector</h2>
            <button
              className="toolbar-button"
              type="button"
              aria-label={expanded ? "Use compact inspector" : "Expand inspector"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            </button>
          </div>
          <div className="trace-stage-summaries">
            {trace.stages.map((stage) => (
              <button
                className={stage.id === selectedStageId ? `trace-summary is-${stage.status} is-active` : `trace-summary is-${stage.status}`}
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
              >
                <strong>{stage.id}</strong>
                <span>{stage.summary ?? stage.status}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="trace-content" role="tabpanel">
          {renderStage(selectedStageId, trace, error, selectedToken, selectToken)}
        </section>
        <aside className="trace-detail">
          {error === null ? <ResultInspector summary={trace.resultSummary} /> : <ExecutionError error={error} />}
        </aside>
      </section>
    </>
  );
}

function renderStage(
  stageId: ExecutionTraceStageId,
  trace: ExecutionTrace,
  error: KansoErrorView | null,
  selectedToken: TokenTraceView | null,
  onSelectToken: (token: TokenTraceView) => void
) {
  switch (stageId) {
    case "sql":
      return <ResultInspector summary={{ resultType: trace.resultSummary?.resultType ?? "query" }} />;
    case "lexer":
      return <TokenInspector tokens={trace.tokens ?? []} error={error} selectedToken={selectedToken} onSelectToken={onSelectToken} />;
    case "parser":
    case "ast":
      return <AstInspector ast={trace.ast} />;
    case "executor":
      return <OperatorTree operators={trace.operators} />;
    case "storage":
      return <StorageInspector storageReads={trace.storageReads} />;
    case "results":
      return <ResultInspector summary={trace.resultSummary} />;
  }
}
