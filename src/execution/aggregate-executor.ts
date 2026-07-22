import type { SelectStatement } from "../parser/ast.js";
import { Database } from "../storage/database.js";
import type { Table } from "../storage/table.js";
import { JoinExecutor } from "./join-executor.js";
import type { QueryResult } from "./query-result.js";

export class AggregateExecutor {
  public execute(statement: SelectStatement, table: Table): QueryResult {
    const database = new Database();
    database.createTable(table.name, table.getSchema());

    const copiedTable = database.getTable(table.name);
    for (const row of table.getRows()) {
      copiedTable.insert(row);
    }

    return new JoinExecutor().execute(statement, database);
  }
}
