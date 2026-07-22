import type { LucideIcon } from "lucide-react";

export type NavigationKey = "tables" | "console" | "scripts" | "engine" | "history" | "settings";

export interface NavigationItemModel {
  icon: LucideIcon;
  key: NavigationKey;
  label: string;
}

export interface SchemaColumn {
  key?: "PK" | "FK" | "UQ";
  name: string;
  nullable?: boolean;
  type: string;
}

export interface SchemaTable {
  columns: SchemaColumn[];
  name: string;
  rows: number;
}

export interface HistoryItem {
  duration: string;
  id: number;
  outcome: string;
  status: "success" | "error";
  statement: string;
}

export interface PipelineStage {
  detail: string;
  duration: string;
  id: string;
  label: string;
  status: "complete" | "active" | "pending";
}

export type InspectorTab = "tokens" | "output";
