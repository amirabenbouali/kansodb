import type { KansoErrorView } from "./executionTypes";
import { ErrorPanel } from "../errors/ErrorPanel";

interface ExecutionErrorProps {
  error: KansoErrorView;
  sourceSql?: string | undefined;
}

export function ExecutionError({ error, sourceSql }: ExecutionErrorProps) {
  return <ErrorPanel error={error} sourceSql={sourceSql} />;
}
