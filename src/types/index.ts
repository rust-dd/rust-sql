export interface ProjectDetails {
  driver: DriverType;
  username: string;
  password: string;
  database: string;
  host: string;
  port: string;
  ssl: string;
}

export type DriverType = "PGSQL";

export type ProjectMap = Record<string, ProjectDetails>;

export type TabType = "query" | "monitor" | "erd" | "terminal";

export interface Tab {
  id: string;
  type: TabType;
  projectId?: string;
  schema?: string;
  title: string;
  editorValue: string;
  isExecuting: boolean;
  result?: QueryResult;
  explainResult?: ExplainPlan;
}

export interface ExplainNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Alias"?: string;
  "Join Type"?: string;
  "Index Name"?: string;
  "Index Cond"?: string;
  "Filter"?: string;
  "Hash Cond"?: string;
  "Merge Cond"?: string;
  "Sort Key"?: string[];
  "Strategy"?: string;
  "Startup Cost": number;
  "Total Cost": number;
  "Plan Rows": number;
  "Plan Width": number;
  "Actual Startup Time"?: number;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: ExplainNode[];
  [key: string]: unknown;
}

export interface ExplainPlan {
  "Plan": ExplainNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
  "Triggers"?: unknown[];
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
  time: number;
}

export interface TableInfo {
  name: string;
  size: string;
}

export interface ColumnDetail {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface IndexDetail {
  indexName: string;
  columnName: string;
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ConstraintDetail {
  constraintName: string;
  constraintType: string;
  columnName: string;
}

export interface TriggerDetail {
  triggerName: string;
  event: string;
  timing: string;
}

export interface RuleDetail {
  ruleName: string;
  event: string;
}

export interface PolicyDetail {
  policyName: string;
  permissive: string;
  command: string;
}

export interface FunctionInfo {
  name: string;
  returnType: string;
  arguments: string;
}

export interface TriggerFunctionInfo {
  name: string;
  arguments: string;
}

export enum ProjectConnectionStatus {
  Connected = "Connected",
  Connecting = "Connecting",
  Disconnected = "Disconnected",
  Failed = "Failed",
}
