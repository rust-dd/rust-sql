export type ObjectType = "table" | "view" | "matview" | "function" | "trigger-function";

export type Tab = "overview" | "columns" | "indexes" | "fkeys" | "ddl" | "actions" | "structure";

export interface ObjectPropertiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectType: ObjectType;
  projectId: string;
  schema: string;
  name: string;
}

export interface TableStats {
  rowEstimate: string;
  tableSize: string;
  indexSize: string;
  totalSize: string;
  lastVacuum: string;
  lastAnalyze: string;
  lastAutoVacuum: string;
  lastAutoAnalyze: string;
  deadTuples: string;
  liveTuples: string;
  seqScan: string;
  idxScan: string;
}

export interface FKInfo {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  onUpdate: string;
  onDelete: string;
}

export interface ViewInfo {
  isUpdatable: string;
  checkOption: string;
  definition: string;
}

export interface FunctionMeta {
  language: string;
  volatility: string;
  isStrict: boolean;
  securityDefiner: boolean;
  estimatedCost: string;
  estimatedRows: string;
  returnType: string;
  arguments: string;
  source: string;
}

export interface MatViewStats {
  rowEstimate: string;
  totalSize: string;
  isPopulated: string;
  definition: string;
}
