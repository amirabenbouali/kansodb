export type DatabaseValue = number | string | boolean | null;
export type InputRow = Record<string, DatabaseValue | undefined>;
export type StoredRow = Record<string, DatabaseValue>;
