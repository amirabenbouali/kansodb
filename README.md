# KansoDB

> A SQL query engine built from scratch in TypeScript.

KansoDB is an educational relational database engine that explores how SQL databases work internally. It implements the query lifecycle in TypeScript, from SQL text to tokens, ASTs, execution, constraints, transactions, and optional JSON-file persistence.

## Current Features

* SQL lexer and recursive-descent parser
* Basic `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`, joins, grouping, aggregates, aliases, and computed expressions
* `CREATE TABLE`, `INSERT`, `UPDATE`, and `DELETE`
* In-memory relational tables with typed columns and rows
* `PRIMARY KEY`, `UNIQUE`, `NOT NULL`, and foreign-key enforcement
* Explicit `BEGIN`, `COMMIT`, and `ROLLBACK`
* Atomic script execution
* Optional JSON persistence with explicit `SAVE`
* Startup recovery from interrupted saves
* TypeScript, Vitest, and modular architecture

## In-Memory Usage

```ts
import { Database, executeSql } from "kansodb";

const database = new Database();

executeSql(database, `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`);

executeSql(database, "INSERT INTO users VALUES (1, 'Amira');");
```

## File-Backed Usage

```ts
import { Database } from "kansodb";

const database = await Database.open({
  path: "./data/kanso.db.json",
  autoSave: "on-commit"
});

await database.executeSql(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`);

await database.executeSql("INSERT INTO users VALUES (1, 'Amira');");
await database.executeSql("SAVE;");
```

Opening a missing path creates an empty in-memory database associated with that path. The file is created only after `SAVE` or an enabled auto-save writes it.

## Persistence

KansoDB persists the logical database state:

* storage format version
* table names
* column names, types, and nullability
* primary keys, unique constraints, and foreign keys
* rows

It does not persist parser objects, executors, file handles, transaction snapshots, or execution history.

The storage format is versioned JSON:

```json
{
  "format": "kansodb",
  "version": 1,
  "savedAt": "2026-07-22T00:00:00.000Z",
  "database": {
    "tables": []
  }
}
```

## Saving

Use SQL:

```sql
SAVE;
```

Or the API:

```ts
await database.save();
```

`SAVE` is rejected while an explicit transaction is active, because persistence represents committed database state only.

## Auto-Save

```ts
type AutoSaveMode = "off" | "on-commit" | "after-mutation";
```

* `off`: only explicit `SAVE` or `database.save()` writes to disk.
* `on-commit`: saves after successful standalone mutations, explicit `COMMIT`, and successful atomic scripts.
* `after-mutation`: saves after successful standalone mutations and once after transaction commit.

If auto-save fails after an in-memory commit, the memory state remains committed and the database is marked dirty so callers can retry `SAVE`.

## Transactions

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

Rollback restores the full in-memory database snapshot captured at `BEGIN`, including schemas, rows, and constraints. Nested transactions and savepoints are intentionally not supported.

## Recovery

Saves use:

```text
database.json.tmp
database.json.bak
```

On startup, KansoDB validates candidates before promotion. It can recover from interrupted saves using a valid temporary or backup file. Corrupt files are not silently replaced with an empty database.

## Limitations

KansoDB currently assumes a single process and a single writer per database file. It does not implement locking, write-ahead logging, crash recovery beyond safe replacement, migrations, indexes, query planning, server APIs, authentication, encryption, replication, a CLI, or a frontend.

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

MIT
