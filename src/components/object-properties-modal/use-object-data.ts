import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import { useCallback, useEffect, useState } from "react";
import type {
  FKInfo,
  FunctionMeta,
  MatViewStats,
  ObjectType,
  TableStats,
  ViewInfo,
} from "./types";

export function useObjectData(
  projectId: string,
  schema: string,
  name: string,
  objectType: ObjectType,
  open: boolean,
) {
  const [ddl, setDdl] = useState<string | null>(null);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tableStats, setTableStats] = useState<TableStats | null>(null);
  const [outgoingFKs, setOutgoingFKs] = useState<FKInfo[]>([]);
  const [incomingFKs, setIncomingFKs] = useState<FKInfo[]>([]);
  const [viewInfo, setViewInfo] = useState<ViewInfo | null>(null);
  const [functionMeta, setFunctionMeta] = useState<FunctionMeta | null>(null);
  const [matViewStats, setMatViewStats] = useState<MatViewStats | null>(null);

  const columnDetails = useProjectStore((s) => s.columnDetails);
  const indexes = useProjectStore((s) => s.indexes);
  const projects = useProjectStore((s) => s.projects);
  const storeLoadColumnDetails = useProjectStore((s) => s.loadColumnDetails);
  const storeLoadIndexes = useProjectStore((s) => s.loadIndexes);

  const metaKey = `${projectId}::${schema}::${name}`;

  const getDriver = useCallback(() => {
    const d = projects[projectId];
    if (!d) return null;
    return DriverFactory.getDriver(d.driver);
  }, [projects, projectId]);

  const fetchLiveData = useCallback(async () => {
    const driver = getDriver();
    if (!driver) return;
    setLoading(true);

    try {
      if (objectType === "table") {
        const [statsResult, outFKResult, inFKResult] = await Promise.allSettled(
          [
            driver.loadTableStatistics?.(projectId, schema, name),
            driver.loadFKDetails?.(projectId, schema, name, "outgoing"),
            driver.loadFKDetails?.(projectId, schema, name, "incoming"),
          ],
        );

        if (!columnDetails[metaKey]) {
          storeLoadColumnDetails(projectId, schema, name).catch(() => {});
        }
        if (!indexes[metaKey]) {
          storeLoadIndexes(projectId, schema, name).catch(() => {});
        }

        if (statsResult.status === "fulfilled" && statsResult.value) {
          const statsMap = Object.fromEntries(statsResult.value);
          setTableStats({
            rowEstimate: statsMap.row_estimate ?? "0",
            tableSize: statsMap.table_size ?? "-",
            indexSize: statsMap.index_size ?? "-",
            totalSize: statsMap.total_size ?? "-",
            lastVacuum: statsMap.last_vacuum ?? "never",
            lastAnalyze: statsMap.last_analyze ?? "never",
            lastAutoVacuum: statsMap.last_autovacuum ?? "never",
            lastAutoAnalyze: statsMap.last_autoanalyze ?? "never",
            deadTuples: statsMap.dead_tuples ?? "0",
            liveTuples: statsMap.live_tuples ?? "0",
            seqScan: statsMap.seq_scan ?? "0",
            idxScan: statsMap.idx_scan ?? "0",
          });
        }

        const parseFKs = (
          result: PromiseSettledResult<
            | [
                string,
                string,
                string,
                string,
                string,
                string,
                string,
                string,
                string,
              ][]
            | undefined
          >,
        ) => {
          if (result.status !== "fulfilled" || !result.value) return [];
          return result.value.map((r) => ({
            constraintName: r[0],
            sourceSchema: r[1],
            sourceTable: r[2],
            sourceColumn: r[3],
            targetSchema: r[4],
            targetTable: r[5],
            targetColumn: r[6],
            onUpdate: r[7],
            onDelete: r[8],
          }));
        };
        setOutgoingFKs(parseFKs(outFKResult));
        setIncomingFKs(parseFKs(inFKResult));
      } else if (objectType === "view") {
        const info = await driver.loadViewInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setViewInfo({
            isUpdatable: infoMap.is_updatable ?? "NO",
            checkOption: infoMap.check_option ?? "NONE",
            definition: infoMap.definition ?? "",
          });
        }
      } else if (objectType === "matview") {
        const info = await driver.loadMatviewInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setMatViewStats({
            rowEstimate: infoMap.row_estimate ?? "0",
            totalSize: infoMap.total_size ?? "-",
            isPopulated: infoMap.is_populated ?? "NO",
            definition: infoMap.definition ?? "",
          });
        }
      } else if (
        objectType === "function" ||
        objectType === "trigger-function"
      ) {
        const info = await driver.loadFunctionInfo?.(projectId, schema, name);
        if (info) {
          const infoMap = Object.fromEntries(info);
          setFunctionMeta({
            language: infoMap.language ?? "",
            volatility: infoMap.volatility ?? "",
            isStrict: infoMap.is_strict === "true",
            securityDefiner: infoMap.security_definer === "true",
            estimatedCost: infoMap.estimated_cost ?? "",
            estimatedRows: infoMap.estimated_rows ?? "",
            returnType: infoMap.return_type ?? "",
            arguments: infoMap.arguments ?? "",
            source: infoMap.source ?? "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch live data:", err);
    } finally {
      setLoading(false);
    }
  }, [
    getDriver,
    objectType,
    projectId,
    schema,
    name,
    columnDetails,
    indexes,
    metaKey,
    storeLoadColumnDetails,
    storeLoadIndexes,
  ]);

  useEffect(() => {
    if (!open) return;
    setDdl(null);
    setDdlError(null);
    setTableStats(null);
    setOutgoingFKs([]);
    setIncomingFKs([]);
    setViewInfo(null);
    setFunctionMeta(null);
    setMatViewStats(null);

    void fetchLiveData();
  }, [open, objectType, projectId, schema, name]);

  const fetchDDL = useCallback(async () => {
    const driver = getDriver();
    if (!driver) return;

    setDdlLoading(true);
    setDdlError(null);
    setDdl(null);

    try {
      if (driver.generateDDL) {
        const result = await driver.generateDDL(
          projectId,
          schema,
          name,
          objectType,
        );
        setDdl(result || "No DDL available");
      }
    } catch (err: any) {
      setDdlError(err?.message ?? "Failed to fetch DDL");
    } finally {
      setDdlLoading(false);
    }
  }, [getDriver, objectType, projectId, schema, name]);

  return {
    ddl,
    ddlLoading,
    ddlError,
    loading,
    tableStats,
    outgoingFKs,
    incomingFKs,
    viewInfo,
    functionMeta,
    matViewStats,
    metaKey,
    getDriver,
    fetchLiveData,
    fetchDDL,
  };
}
