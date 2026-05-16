export interface ActivityRow {
  pid: string;
  user: string;
  database: string;
  state: string;
  waitEventType: string;
  waitEvent: string;
  query: string;
  durationSec: string;
  backendType: string;
  clientAddr: string;
}

export interface TableStatRow {
  schema: string;
  table: string;
  seqScan: string;
  seqTupRead: string;
  idxScan: string;
  idxTupFetch: string;
  inserts: string;
  updates: string;
  deletes: string;
  liveTuples: string;
  deadTuples: string;
  lastVacuum: string;
  lastAutovacuum: string;
  lastAnalyze: string;
}

export interface LockRow {
  pid: string;
  user: string;
  mode: string;
  locktype: string;
  status: string;
  relation: string;
  schema: string;
  query: string;
  duration: string;
  waitEvent: string;
}

export interface IndexUsageRow {
  schema: string;
  table: string;
  index: string;
  size: string;
  scans: string;
  tuplesRead: string;
  tuplesFetched: string;
  status: string;
  definition: string;
}

export interface BloatRow {
  schema: string;
  table: string;
  liveTuples: string;
  deadTuples: string;
  bloatPct: string;
  totalSize: string;
  lastVacuum: string;
  lastAutovacuum: string;
  lastAnalyze: string;
  lastAutoanalyze: string;
}

export type MonitorTab =
  | "overview"
  | "activity"
  | "tables"
  | "history"
  | "locks"
  | "indexes"
  | "bloat";
