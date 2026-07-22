import type { HistoryFiltersState, HistoryStatusFilter, QueryHistoryEntry } from "./historyTypes";

interface HistoryFiltersProps {
  entries: readonly QueryHistoryEntry[];
  filters: HistoryFiltersState;
  onFiltersChange: (filters: HistoryFiltersState) => void;
}

const statusOptions: HistoryStatusFilter[] = ["all", "success", "error"];

export function HistoryFilters({ entries, filters, onFiltersChange }: HistoryFiltersProps) {
  const resultTypes = Array.from(new Set(entries.map((entry) => entry.resultType).filter((value): value is string => value !== undefined))).sort();

  return (
    <div className="history-filters">
      <label>
        <span>Search SQL</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search history..."
        />
      </label>
      <label>
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as HistoryStatusFilter })}
        >
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label>
        <span>Result</span>
        <select
          value={filters.resultType}
          onChange={(event) => onFiltersChange({ ...filters, resultType: event.target.value })}
        >
          <option value="all">all</option>
          {resultTypes.map((resultType) => <option key={resultType} value={resultType}>{resultType}</option>)}
        </select>
      </label>
    </div>
  );
}
