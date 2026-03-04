export interface ProjectDetails {
  driver: DriverType;
  username: string;
  password: string;
  database: string;
  host: string;
  port: string;
  ssl: string;
}

export type DriverType = "PGSQL" | "REDSHIFT";

export type ProjectMap = Record<string, ProjectDetails>;

export type TabType = "query" | "monitor";

export interface Tab {
  id: string;
  type: TabType;
  projectId?: string;
  title: string;
  editorValue: string;
  isExecuting: boolean;
  result?: QueryResult;
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
