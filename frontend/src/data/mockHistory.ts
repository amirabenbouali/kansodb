import type { HistoryItem } from "../types/ui";

export const mockHistory: HistoryItem[] = [
  {
    id: 1,
    statement: "SELECT e.name, d.name...",
    duration: "3.7 ms",
    outcome: "10 rows",
    status: "success"
  },
  {
    id: 2,
    statement: "SELECT COUNT(*) FROM ...",
    duration: "1.2 ms",
    outcome: "1 row",
    status: "success"
  },
  {
    id: 3,
    statement: "UPDATE employees SET ...",
    duration: "5 min ago",
    outcome: "Error",
    status: "error"
  }
];
