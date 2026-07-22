import type { PersistenceExecutionView } from "./executionTypes";

interface PersistenceResultProps {
  result: PersistenceExecutionView;
}

export function PersistenceResult({ result }: PersistenceResultProps) {
  return (
    <div className="result-card is-success">
      <strong>Database saved</strong>
      <span>{result.path} · {result.bytesWritten.toLocaleString()} bytes</span>
    </div>
  );
}
