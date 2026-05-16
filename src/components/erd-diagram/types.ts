import type { ForeignKey } from "@/lib/database-driver";

export type { ForeignKey };

export interface ERDProps {
  projectId: string;
  schema: string;
}

export interface ERDColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPK: boolean;
  isFK: boolean;
}

export interface TableBox {
  name: string;
  columns: ERDColumn[];
  x: number;
  y: number;
  width: number;
  height: number;
}
