import { useMemo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ResultsMapProps {
  columns: string[];
  rows: string[][];
}

// WKT patterns for detecting geometry columns
const WKT_PREFIX =
  /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i;
const GEOJSON_PREFIX = /^\s*\{\s*"type"\s*:/;
const WKB_HEX = /^[0-9a-f]{8,}$/i;

// Simple hex byte reader for EWKB
function hexToFloat64LE(hex: string, offset: number): number {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.substr(offset + i * 2, 2), 16);
  }
  return new Float64Array(bytes.buffer)[0];
}

function parseEWKBPoint(hex: string): [number, number] | null {
  try {
    // EWKB: byte_order(1) + type(4) [+ srid(4)] + x(8) + y(8)
    const bo = hex.substring(0, 2); // 01 = little-endian
    if (bo !== "01") return null;
    let typeHex = hex.substring(2, 10);
    const typeInt = parseInt(
      typeHex.substring(6, 8) + typeHex.substring(4, 6) + typeHex.substring(2, 4) + typeHex.substring(0, 2),
      16,
    );
    const hasSRID = (typeInt & 0x20000000) !== 0;
    const geomType = typeInt & 0xff;
    if (geomType !== 1) return null; // Only POINT

    let offset = 10;
    if (hasSRID) offset += 8; // skip SRID (4 bytes = 8 hex chars)
    const x = hexToFloat64LE(hex, offset);
    const y = hexToFloat64LE(hex, offset + 16);
    return [y, x]; // Leaflet uses [lat, lng]
  } catch {
    return null;
  }
}

interface ParsedGeom {
  type: "point" | "linestring" | "polygon";
  coords: [number, number][];
  rowIndex: number;
}

function parseWKT(wkt: string, rowIndex: number): ParsedGeom | null {
  const upper = wkt.trim().toUpperCase();
  if (upper.startsWith("POINT")) {
    const m = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)/i);
    if (m) return { type: "point", coords: [[parseFloat(m[2]), parseFloat(m[1])]], rowIndex };
  } else if (upper.startsWith("LINESTRING")) {
    const m = wkt.match(/LINESTRING\s*\((.+)\)/i);
    if (m) {
      const coords = m[1].split(",").map((p) => {
        const [x, y] = p.trim().split(/\s+/).map(Number);
        return [y, x] as [number, number];
      });
      return { type: "linestring", coords, rowIndex };
    }
  } else if (upper.startsWith("POLYGON")) {
    const m = wkt.match(/POLYGON\s*\(\((.+?)\)/i);
    if (m) {
      const coords = m[1].split(",").map((p) => {
        const [x, y] = p.trim().split(/\s+/).map(Number);
        return [y, x] as [number, number];
      });
      return { type: "polygon", coords, rowIndex };
    }
  }
  return null;
}

function parseGeoJSON(json: string, rowIndex: number): ParsedGeom | null {
  try {
    const obj = JSON.parse(json);
    if (obj.type === "Point" && obj.coordinates) {
      return { type: "point", coords: [[obj.coordinates[1], obj.coordinates[0]]], rowIndex };
    }
    if (obj.type === "LineString" && obj.coordinates) {
      return {
        type: "linestring",
        coords: obj.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
        rowIndex,
      };
    }
    if (obj.type === "Polygon" && obj.coordinates?.[0]) {
      return {
        type: "polygon",
        coords: obj.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]),
        rowIndex,
      };
    }
  } catch {
    // not valid JSON
  }
  return null;
}

function detectGeomColumnIndex(columns: string[], rows: string[][]): number {
  // Check first 10 rows for geometry-like data
  const sample = rows.slice(0, 10);
  for (let ci = 0; ci < columns.length; ci++) {
    const colName = columns[ci].toLowerCase();
    // Check column name hints
    const isGeoName = /geom|geometry|geography|location|coordinates|the_geom|wkb_geometry|shape|point|latlng/.test(colName);

    let geoCount = 0;
    for (const row of sample) {
      const val = row[ci] ?? "";
      if (WKT_PREFIX.test(val) || GEOJSON_PREFIX.test(val) || (WKB_HEX.test(val) && val.length >= 40)) {
        geoCount++;
      }
    }

    if (geoCount >= Math.min(3, sample.length) || (isGeoName && geoCount > 0)) {
      return ci;
    }
  }
  return -1;
}

export function hasGeometryColumn(columns: string[], rows: string[][]): boolean {
  return detectGeomColumnIndex(columns, rows) >= 0;
}

export function ResultsMap({ columns, rows }: ResultsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  const geomCol = useMemo(() => detectGeomColumnIndex(columns, rows), [columns, rows]);

  const geometries = useMemo(() => {
    if (geomCol < 0) return [];
    const result: ParsedGeom[] = [];
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][geomCol] ?? "";
      let parsed: ParsedGeom | null = null;

      if (WKT_PREFIX.test(val)) {
        parsed = parseWKT(val, i);
      } else if (GEOJSON_PREFIX.test(val)) {
        parsed = parseGeoJSON(val, i);
      } else if (WKB_HEX.test(val) && val.length >= 40) {
        const pt = parseEWKBPoint(val);
        if (pt) parsed = { type: "point", coords: [pt], rowIndex: i };
      }

      if (parsed) result.push(parsed);
    }
    return result;
  }, [rows, geomCol]);

  useEffect(() => {
    if (!mapRef.current || geometries.length === 0) return;

    // Create map if not exists
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([0, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(leafletMap.current);
    }

    const map = leafletMap.current;

    // Clear existing layers (except tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    // Add geometries
    const bounds = L.latLngBounds([]);
    const nonGeomCols = columns.filter((_, i) => i !== geomCol);

    for (const geom of geometries) {
      // Build popup content from non-geometry columns
      const row = rows[geom.rowIndex];
      const popupContent = nonGeomCols
        .map((col) => {
          const ci = columns.indexOf(col);
          return `<b>${col}:</b> ${row[ci] ?? ""}`;
        })
        .join("<br>");

      if (geom.type === "point" && geom.coords.length > 0) {
        const [lat, lng] = geom.coords[0];
        if (isFinite(lat) && isFinite(lng)) {
          const marker = L.circleMarker([lat, lng], {
            radius: 6,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.7,
            weight: 2,
          }).addTo(map);
          if (popupContent) marker.bindPopup(popupContent);
          bounds.extend([lat, lng]);
        }
      } else if (geom.type === "linestring") {
        const line = L.polyline(geom.coords, { color: "#3b82f6", weight: 3 }).addTo(map);
        if (popupContent) line.bindPopup(popupContent);
        geom.coords.forEach((c) => bounds.extend(c));
      } else if (geom.type === "polygon") {
        const poly = L.polygon(geom.coords, {
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(map);
        if (popupContent) poly.bindPopup(popupContent);
        geom.coords.forEach((c) => bounds.extend(c));
      }
    }

    // Fit map to bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    return () => {};
  }, [geometries, columns, rows, geomCol]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Invalidate map size when container resizes
  useEffect(() => {
    if (!mapRef.current || !leafletMap.current) return;
    const obs = new ResizeObserver(() => {
      leafletMap.current?.invalidateSize();
    });
    obs.observe(mapRef.current);
    return () => obs.disconnect();
  }, []);

  if (geomCol < 0 || geometries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <span className="text-sm">No geometry data detected in results</span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-card/90 border border-border rounded px-2 py-1 text-xs font-mono text-muted-foreground">
        {geometries.length} geometries from "{columns[geomCol]}"
      </div>
    </div>
  );
}
