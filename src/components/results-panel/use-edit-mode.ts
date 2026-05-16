import { useCallback, useEffect, useMemo, useState } from "react";
import { useTabStore } from "@/stores/tab-store";
import { useProjectStore } from "@/stores/project-store";
import { DriverFactory } from "@/lib/database-driver";
import { parseSelectTable, generateUpdate, generateDelete, quoteIdent, quoteLiteral } from "@/lib/sql-utils";
import type { ForeignKey } from "@/lib/database-driver";
import type { EditState } from "./types";

interface UseEditModeArgs {
  projectId: string | undefined;
  editorValue: string | undefined;
  result: { columns: string[]; rows: string[][]; time: number; capped?: boolean } | null | undefined;
}

export function useEditMode({ projectId, editorValue, result }: UseEditModeArgs) {
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);

  // Detect if query is a simple SELECT (editable)
  const editableTable = useMemo(() => {
    if (!editorValue) return null;
    return parseSelectTable(editorValue);
  }, [editorValue]);

  // FK column map: columnName → { targetSchema, targetTable, targetColumn }
  const [fkMap, setFkMap] = useState<Map<string, { schema: string; table: string; column: string }>>(new Map());

  useEffect(() => {
    if (!editableTable || !projectId) {
      setFkMap(new Map());
      return;
    }
    const pid = projectId;
    const d = useProjectStore.getState().projects[pid];
    if (!d) return;

    const driver = DriverFactory.getDriver(d.driver);
    driver.loadForeignKeys(pid, editableTable.schema).then((fks: ForeignKey[]) => {
      const map = new Map<string, { schema: string; table: string; column: string }>();
      for (const fk of fks) {
        if (fk.sourceTable === editableTable.table) {
          map.set(fk.sourceColumn, {
            schema: editableTable.schema,
            table: fk.targetTable,
            column: fk.targetColumn,
          });
        }
      }
      setFkMap(map);
    }).catch(() => setFkMap(new Map()));
  }, [editableTable, projectId]);

  // FK navigate handler - opens a new tab and auto-executes the query
  const handleFKNavigate = useCallback(
    (colName: string, value: string) => {
      const target = fkMap.get(colName);
      if (!target || !projectId) return;

      const pid = projectId;
      const sql = `SELECT * FROM ${quoteIdent(target.schema)}.${quoteIdent(target.table)} WHERE ${quoteIdent(target.column)} = ${quoteLiteral(value)} LIMIT 100`;
      useTabStore.getState().openTab(pid, sql);

      // Auto-execute the query in the new tab
      const d = useProjectStore.getState().projects[pid];
      if (!d) return;
      const newTabIdx = useTabStore.getState().tabs.length - 1;
      useTabStore.getState().setExecuting(newTabIdx, true);
      const driver = DriverFactory.getDriver(d.driver);
      driver.runQuery(pid, sql).then(([cols, rows, time]) => {
        useTabStore.getState().updateResult(newTabIdx, { columns: cols, rows, time });
      }).catch(() => {
        useTabStore.getState().setExecuting(newTabIdx, false);
      });
    },
    [fkMap, projectId],
  );

  // Enter edit mode
  const handleEnterEdit = useCallback(async () => {
    if (!editableTable || !projectId) return;
    const d = useProjectStore.getState().projects[projectId];
    if (!d) return;
    setEditError(null);

    try {
      const driver = DriverFactory.getDriver(d.driver);
      const indexes = await driver.loadIndexes(
        projectId,
        editableTable.schema,
        editableTable.table,
      );
      const pkColumns = [...new Set(indexes.filter((i) => i.isPrimary).map((i) => i.columnName))];

      if (pkColumns.length === 0) {
        setEditError("No primary key found. Inline editing requires a primary key.");
        return;
      }

      // Check that PK columns exist in result columns
      const resultCols = result?.columns ?? [];
      const missingPKs = pkColumns.filter((pk) => !resultCols.includes(pk));
      if (missingPKs.length > 0) {
        setEditError(`Primary key column(s) ${missingPKs.join(", ")} not in query results. Select all PK columns to edit.`);
        return;
      }

      setEditState({
        schema: editableTable.schema,
        table: editableTable.table,
        pkColumns,
        cellEdits: new Map(),
        deletedRows: new Set(),
      });
      setIsEditing(true);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to load table info");
    }
  }, [editableTable, projectId, result?.columns]);

  // Discard edits
  const handleDiscard = useCallback(() => {
    setIsEditing(false);
    setEditState(null);
    setEditError(null);
  }, []);

  // Run statements + refresh results helper
  const runAndRefresh = useCallback(async (statements: string[]) => {
    if (!projectId || statements.length === 0) return;
    setIsCommitting(true);
    setEditError(null);

    try {
      const d = useProjectStore.getState().projects[projectId];
      if (!d) throw new Error("Project not found");
      const driver = DriverFactory.getDriver(d.driver);

      const txnSql = ["BEGIN", ...statements, "COMMIT"].join(";\n");
      await driver.runQuery(projectId, txnSql, 30000);

      const [cols, rows, time] = await driver.runQuery(projectId, editorValue ?? "");
      const tabIdx = useTabStore.getState().selectedTabIndex;
      useTabStore.getState().updateResult(tabIdx, { columns: cols, rows, time });

      setIsEditing(false);
      setEditState(null);
      setPendingDeleteCount(0);
    } catch (err: any) {
      setEditError(err?.message ?? "Commit failed");
    } finally {
      setIsCommitting(false);
    }
  }, [projectId, editorValue]);

  // Commit — only cell edits (UPDATEs), no deletes
  const handleCommit = useCallback(() => {
    if (!editState || !result) return;
    const { schema, table, pkColumns, cellEdits, deletedRows } = editState;
    const columns = result.columns;
    const originalRows = result.rows;

    const editsByRow = new Map<number, Map<number, string>>();
    for (const [key, value] of cellEdits) {
      const [rowStr, colStr] = key.split(":");
      const rowIdx = parseInt(rowStr);
      const colIdx = parseInt(colStr);
      if (deletedRows.has(rowIdx)) continue;
      if (!editsByRow.has(rowIdx)) editsByRow.set(rowIdx, new Map());
      editsByRow.get(rowIdx)!.set(colIdx, value);
    }

    const statements: string[] = [];
    for (const [rowIdx, changes] of editsByRow) {
      statements.push(generateUpdate(schema, table, columns, originalRows[rowIdx], changes, pkColumns));
    }

    if (statements.length === 0) {
      handleDiscard();
      return;
    }

    void runAndRefresh(statements);
  }, [editState, result, handleDiscard, runAndRefresh]);

  // Delete — only checked rows (DELETEs), with inline confirmation
  const handleDeleteRows = useCallback(() => {
    if (!editState || editState.deletedRows.size === 0) return;
    setPendingDeleteCount(editState.deletedRows.size);
  }, [editState]);

  const handleConfirmDelete = useCallback(() => {
    if (!editState || !result) return;
    const { schema, table, pkColumns, deletedRows } = editState;
    const columns = result.columns;
    const originalRows = result.rows;

    const statements: string[] = [];
    for (const rowIdx of deletedRows) {
      statements.push(generateDelete(schema, table, columns, originalRows[rowIdx], pkColumns));
    }

    setPendingDeleteCount(0);
    void runAndRefresh(statements);
  }, [editState, result, runAndRefresh]);

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteCount(0);
  }, []);

  // Cell edit handler
  const handleCellEdit = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      setEditState((prev) => {
        if (!prev) return prev;
        const newEdits = new Map(prev.cellEdits);
        const original = result?.rows[rowIndex]?.[colIndex] ?? "";
        if (value === original) {
          newEdits.delete(`${rowIndex}:${colIndex}`);
        } else {
          newEdits.set(`${rowIndex}:${colIndex}`, value);
        }
        return { ...prev, cellEdits: newEdits };
      });
    },
    [result],
  );

  const handleRowDelete = useCallback((rowIndex: number) => {
    setEditState((prev) => {
      if (!prev) return prev;
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.add(rowIndex);
      return { ...prev, deletedRows: newDeleted };
    });
  }, []);

  const handleRowRestore = useCallback((rowIndex: number) => {
    setEditState((prev) => {
      if (!prev) return prev;
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.delete(rowIndex);
      return { ...prev, deletedRows: newDeleted };
    });
  }, []);

  return {
    isEditing,
    editState,
    editError,
    setEditError,
    isCommitting,
    pendingDeleteCount,
    editableTable,
    fkMap,
    handleFKNavigate,
    handleEnterEdit,
    handleDiscard,
    handleCommit,
    handleDeleteRows,
    handleConfirmDelete,
    handleCancelDelete,
    handleCellEdit,
    handleRowDelete,
    handleRowRestore,
  };
}
