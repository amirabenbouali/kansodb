import { Search } from "lucide-react";

interface SchemaSearchProps {
  onSearchChange: (value: string) => void;
  search: string;
}

export function SchemaSearch({ onSearchChange, search }: SchemaSearchProps) {
  return (
    <label className="search-box">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Search tables and columns</span>
      <input
        value={search}
        placeholder="Search tables or columns..."
        aria-label="Search tables and columns"
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </label>
  );
}
