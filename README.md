# KansoDB

> A SQL query engine built from scratch in TypeScript.

KansoDB is an educational relational database engine that explores how SQL databases work internally. Rather than relying on PostgreSQL, SQLite, or MySQL, every stage of the query lifecycle is implemented from scratch—from reading SQL text to producing query results.

The goal of this project is to understand and demonstrate the core concepts behind relational databases, query execution, and language parsing while following modern software engineering practices.

---

## Features

### SQL Parsing

* Lexical analysis (tokenization)
* Recursive descent parser
* Abstract Syntax Tree (AST)

### Query Execution

* In-memory relational storage
* Table scanning
* Filtering (`WHERE`)
* Column projection (`SELECT`)
* Sorting (`ORDER BY`)
* Result limiting (`LIMIT`)

### Storage

* Relational tables
* Typed columns
* Rows
* Schema validation

### Developer Experience

* TypeScript
* Unit tests
* Modular architecture
* CLI interface

---

## Roadmap

### Phase 1

* [ ] Lexer
* [ ] Parser
* [ ] AST
* [ ] In-memory storage
* [ ] Basic `SELECT`

### Phase 2

* [ ] `WHERE`
* [ ] `ORDER BY`
* [ ] `LIMIT`
* [ ] `INSERT`
* [ ] `CREATE TABLE`

### Phase 3

* [ ] Aggregations
* [ ] `GROUP BY`
* [ ] `INNER JOIN`
* [ ] Indexes

### Phase 4

* [ ] Query planner
* [ ] `EXPLAIN`
* [ ] File persistence
* [ ] Interactive playground

---

## Example

```sql
SELECT name, salary
FROM employees
WHERE department = 'Engineering'
ORDER BY salary DESC
LIMIT 5;
```

Execution pipeline:

```text
SQL Query
    │
    ▼
Lexer
    │
    ▼
Parser
    │
    ▼
Abstract Syntax Tree
    │
    ▼
Query Planner
    │
    ▼
Execution Engine
    │
    ▼
Result Set
```

---

## Architecture

```
src/
├── lexer/
├── parser/
├── planner/
├── execution/
├── storage/
├── cli/
├── types/
└── tests/
```

Each module has a single responsibility, making the engine easy to understand, extend, and test.

---

## Learning Goals

KansoDB is designed to deepen understanding of:

* Programming language parsing
* Database internals
* Algorithms and data structures
* Query optimisation
* Software architecture
* Type-safe API design

---

## License

MIT
