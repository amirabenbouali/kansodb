import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SchemaProvider } from "./schemaProvider";
import { SchemaEmptyState } from "./SchemaEmptyState";
import { SchemaSearch } from "./SchemaSearch";
import { SchemaTableCard } from "./SchemaTableCard";
import type { DatabaseSchemaView, TableSchemaView } from "./schemaTypes";

interface SchemaExplorerProps {
  onInsertSql: (sql: string) => void;
  provider: SchemaProvider;
  refreshToken: number;
}

type SchemaState =
  | { status: "loading"; schema: DatabaseSchemaView | null }
  | { status: "loaded"; schema: DatabaseSchemaView }
  | { status: "empty"; schema: DatabaseSchemaView }
  | { status: "error"; message: string; schema: DatabaseSchemaView | null };

export function SchemaExplorer({ onInsertSql, provider, refreshToken }: SchemaExplorerProps) {
  const [schemaState, setSchemaState] = useState<SchemaState>({ status: "loading", schema: null });
  const [search, setSearch] = useState("");
  const [expandedTables, setExpandedTables] = useState<ReadonlySet<string>>(() => new Set(["employees"]));
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const tableRefs = useRef(new Map<string, HTMLElement>());

  const loadSchema = useCallback(async () => {
    setSchemaState((currentState) => ({ status: "loading", schema: currentState.schema }));

    try {
      const schema = await provider.getSchema();
      setSchemaState(schema.tables.length === 0
        ? { status: "empty", schema }
        : { status: "loaded", schema });
    } catch (error) {
      setSchemaState({
        status: "error",
        schema: null,
        message: error instanceof Error ? error.message : "Unable to load schema."
      });
    }
  }, [provider]);

  useEffect(() => {
    void loadSchema();
  }, [loadSchema, refreshToken]);

  const schema = schemaState.schema;
  const filteredTables = useMemo(
    () => schema === null ? [] : filterTables(schema.tables, search),
    [schema, search]
  );

  const toggleTable = (tableName: string) => {
    setExpandedTables((currentTables) => {
      const nextTables = new Set(currentTables);
      if (nextTables.has(tableName)) {
        nextTables.delete(tableName);
      } else {
        nextTables.add(tableName);
      }
      return nextTables;
    });
  };

  const revealForeignKey = (tableName: string) => {
    setExpandedTables((currentTables) => new Set(currentTables).add(tableName));
    setHighlightedTable(tableName);

    window.setTimeout(() => {
      const tableElement = tableRefs.current.get(tableName);
      const cardElement = tableElement?.querySelector(".schema-table-card");
      tableElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      cardElement?.classList.add("is-highlighted");
      window.setTimeout(() => cardElement?.classList.remove("is-highlighted"), 1200);
    }, 0);

    window.setTimeout(() => setHighlightedTable(null), 1200);
  };

  const tableCount = schema?.tables.length ?? 0;

  return (
    <section className="right-section schema-explorer" aria-label="Database schema explorer">
      <div className="schema-explorer-heading">
        <div>
          <h2>Database Schema</h2>
          <p>{schema?.databaseName ?? "company.db"} · {tableCount} tables</p>
        </div>
        <button className="schema-refresh-button" type="button" onClick={() => void loadSchema()} aria-label="Refresh schema">
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <SchemaSearch search={search} onSearchChange={setSearch} />

      {schemaState.status === "loading" ? <SchemaEmptyState message="Loading schema..." /> : null}
      {schemaState.status === "error" ? <SchemaEmptyState tone="error" message={schemaState.message} /> : null}
      {schemaState.status === "empty" ? <SchemaEmptyState message="This database has no tables." /> : null}

      {schemaState.status === "loaded" && filteredTables.length === 0 ? (
        <SchemaEmptyState message={`No tables or columns match "${search}".`} />
      ) : null}

      {schemaState.status === "loaded" && filteredTables.length > 0 ? (
        <div className="schema-stack">
          {filteredTables.map((table) => (
            <div
              key={table.name}
              ref={(element) => {
                if (element === null) {
                  tableRefs.current.delete(table.name);
                } else {
                  tableRefs.current.set(table.name, element);
                }
              }}
            >
              <SchemaTableCard
                expanded={expandedTables.has(table.name)}
                highlighted={highlightedTable === table.name}
                onInsertColumn={onInsertSql}
                onInsertStarterQuery={(tableName) => onInsertSql(starterQueryFor(tableName))}
                onInsertTable={onInsertSql}
                onRevealForeignKey={revealForeignKey}
                onToggle={() => toggleTable(table.name)}
                table={table}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function filterTables(tables: TableSchemaView[], search: string): TableSchemaView[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return tables;
  }

  return tables
    .map((table) => {
      const tableMatches = table.name.toLowerCase().includes(normalizedSearch);
      const matchingColumns = table.columns.filter((column) => column.name.toLowerCase().includes(normalizedSearch));

      if (!tableMatches && matchingColumns.length === 0) {
        return null;
      }

      return {
        ...table,
        columns: tableMatches ? table.columns : matchingColumns
      };
    })
    .filter((table): table is TableSchemaView => table !== null);
}

function starterQueryFor(tableName: string): string {
  return `SELECT *
FROM ${tableName}
LIMIT 100;`;
}
