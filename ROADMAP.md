# RSQL — Feature Roadmap

A prioritizált lista a tervezett feature-ökről. A kutatás a DataGrip, DBeaver, TablePlus, Beekeeper Studio feature listáin és a fejlesztői közösség visszajelzésein alapul.

---

## Tier 1 — Magas hatás, gyors megvalósítás

### 1. Safe Mode / Production Guard
**Effort:** Alacsony | **Impact:** Nagyon magas

- Szín-kódolt connection-ök: piros = production, sárga = staging, zöld = development
- Az ablak titlebar / chrome a connection színét veszi fel — egy pillantásra látni, hol vagy
- Production connection-ök read-only módba állíthatók (csak SELECT/EXPLAIN engedélyezett)
- DML/DDL futtatáshoz explicit Cmd+Shift+Enter szükséges + preview az érintett sorokról
- "Code review" panel: az összes pending módosítás diff-ként jelenik meg commit előtt (mint TablePlus)

**Miért:** A TablePlus legjobban szeretett feature-je. Minden fejlesztő félelme, hogy production-ön futtat véletlenül DELETE-et.

---

### 2. AI-Powered Text-to-SQL (Cmd+I)
**Effort:** Közepes | **Impact:** Nagyon magas

- Natural language → SQL a jelenlegi schema context-tel
- A Rust backend introspect-álja az `information_schema`-t és `pg_catalog`-ot, kompakt schema leírást küld az LLM-nek
- Támogatott provider-ek: OpenAI, Anthropic Claude, **Ollama (lokális modellek)** — user saját API kulcsot ad meg
- Inline prompt az editorban (Cmd+I) vagy dedikált chat panel
- Jobb-klikk akciók: "Explain this query in English", "Suggest indexes for this query"
- Lokális modell támogatás az igazi differenciátor — a legtöbb competitor csak cloud API-t támogat

**Miért:** 2025-2026-ban ez a #1 trend a database tooling-ban. DataGrip, Beekeeper Studio, Chat2DB mind szállítja.

---

### 3. Inline Charts / Data Visualization
**Effort:** Alacsony | **Impact:** Magas

- Új "Chart" tab a results panelen (Grid / Record / History / **Chart**)
- Auto-detect: numerikus oszlop = Y tengely, kategorikus/timestamp = X tengely
- Chart típusok: bar, line, pie, scatter
- Lightweight lib: `recharts` vagy `visx` (React + D3)
- Export PNG/SVG
- Aggregate query → azonnali vizualizáció, nem kell CSV-be exportálni és spreadsheet-ben chart-olni

**Miért:** Fejlesztők napi szinten futtatnak COUNT/SUM/AVG query-ket és az eredményt spreadsheet-be másolják chart-hoz.

---

### 4. Query Parameterization
**Effort:** Alacsony | **Impact:** Közepes-Magas

- `$1`, `:param_name`, `?` placeholder detektálás az SQL-ben
- Parameter input panel az editor felett/mellett
- Típus kiválasztás (text, int, boolean, date, stb.)
- Native PostgreSQL parameterized execution (`tokio-postgres` támogatja natívan) — nem string interpoláció
- Parameter set-ek menthetők a saved query-k mellett
- SQL injection is megelőzhető a tool-on belül

**Miért:** Application kódból jövő query-k teszteléséhez elengedhetetlen. DataGrip tudja, a legtöbb más tool nem.

---

## Tier 2 — Erős feature-ök, közepes effort

### 5. Visual Query Builder
**Effort:** Közepes-Magas | **Impact:** Magas

- Canvas ahol a schema browser-ből húzhatók táblák
- Oszlopok megjelennek, FK vonalak automatikusan
- JOIN-ok létrehozása vonalak húzásával
- SELECT oszlopok kiválasztása checkbox-szal
- WHERE feltételek form field-ekkel
- Real-time SQL generálás split pane-ben — a user szerkesztheti közvetlenül
- Kiindulópont: a meglévő `erd-diagram.tsx` component

**Miért:** Ismeretlen, 50+ táblás schema-knál nagyon hasznos az onboarding-hoz. Navicat és DBeaver Pro feature.

---

### 6. Multi-Format Import (Excel, Parquet, JSON)
**Effort:** Közepes | **Impact:** Magas

- **Excel (.xlsx)** — Rust `calamine` crate
- **Parquet** — Rust `arrow` / `parquet` crate-ek
- **JSON array** — `sonic-rs` (már van a projektben)
- Column mapping UI (mint a meglévő CSV importnál)
- Preview az első N sorból
- Bulk insert `COPY` protokollal
- **Parquet támogatás az igazi differenciátor** — szinte egyetlen GUI client sem kezeli natívan, pedig a data engineering pipeline-okban mindenhol van

**Miért:** A CSV importon túl a valós workflow-kban Excel és Parquet fájlok is jönnek.

---

### 7. Schema Migration Script Generation
**Effort:** Közepes | **Impact:** Magas

- A meglévő `schema-diff-panel.tsx` kimenetéből generálható futtatható migration script
- `ALTER TABLE`, `CREATE INDEX`, `DROP CONSTRAINT` stb. helyes sorrendben (dependency-aware)
- Kiválasztható, melyik változások kerüljenek be
- Flyway/Liquibase-kompatibilis output formátum opció
- Másolás vágólapra vagy mentés `.sql` fájlba
- Opcionálisan: `migrations/` mappa konvenció integráció

**Miért:** A schema diff vizuális, de a fejlesztőknek futtatható SQL kell. DataGrip csinálja, a legtöbb más tool nem.

---

### 8. Backup & Restore GUI
**Effort:** Alacsony-Közepes | **Impact:** Közepes

- `pg_dump` / `pg_restore` wrapper
- Form UI: formátum (custom/plain/directory), schema-only / data-only, compression level, specific tables
- Progress streaming a Rust child process kimenetéből
- Backup history
- Feltétel: `pg_dump` elérhető legyen a rendszeren

**Miért:** pgAdmin az egyetlen GUI ami csinálja. Mindenki más terminálba kényszerül.

---

## Tier 3 — Egyedi differenciátorok

### 9. RLS Policy Editor
**Effort:** Közepes | **Impact:** Közepes | **Differenciáció:** Nagyon magas

- Vizuális editor Row-Level Security policy-khez
- Per-tábla policy lista: role, operation (SELECT/INSERT/UPDATE/DELETE/ALL), USING/WITH CHECK expression
- Form: role kiválasztás, operation, expression editor autocomplete-tel (oszlopnevek, `current_user`, `current_setting()`)
- Preview: generált `CREATE POLICY` / `ALTER POLICY` statement
- **Egyetlen GUI client sem csinálja jól** — Supabase/multi-tenant app fejlesztőknek kritikus

**Miért:** Az RLS egyre elterjedtebb (különösen Supabase-nél), de raw SQL-ben kezelni fájdalmas.

---

### 10. Local DuckDB / PGLite Execution
**Effort:** Közepes | **Impact:** Közepes | **Differenciáció:** Nagyon magas

- "Local" connection típus — nincs szükség PostgreSQL szerverre
- CSV/Parquet/JSON fájl drag-and-drop → automatikus DuckDB virtual table
- SQL futtatás lokálisan, offline
- Scratchpad mód: gyors adat-exploráció fájlokból anélkül, hogy importálni kellene PostgreSQL-be
- DuckDB C API hívható Rust-ból; PGLite már a website kódbázisban van

**Miért:** Data engineer-ek és analyst-ek gyakran csak meg akarnak nézni egy fájlt SQL-ben, anélkül hogy teljes DB-t állítanának be.

---

### 11. Vim-Style Keyboard Navigation
**Effort:** Alacsony | **Impact:** Közepes | **Differenciáció:** Magas

- Monaco vim mode (`monaco-vim` extension — drop-in)
- Grid navigáció: arrow keys, Enter = szerkesztés, Escape = mégse, Tab = következő cella
- Schema browser: j/k navigáció, Enter = kibontás
- Keyboard shortcuts referencia panel (Cmd+?)
- Customizable key bindings

**Miért:** Power user-ek HN-en és Reddit-en folyamatosan kérik. Egyetlen competitor sem teljesen keyboard-navigálható.

---

### 12. Multi-Database Support
**Effort:** Magas | **Impact:** Nagyon magas | **Differenciáció:** Alacsony (elvárt)

- A `crates/rsql-core/src/drivers/pgsql/` struktúra már kész az extensibility-re (`mod.rs` + submodules), és `crates/rsql-tauri/` csak a Tauri wrappereket tartalmazza
- **MySQL** — `mysql_async` crate
- **SQLite** — `rusqlite` crate
- **Redis** — `redis` crate
- Minden driver egy közös trait-et implementál
- A frontend adaptálja a schema browser-t és az editor autocomplete-et az aktív driver alapján

**Miért:** A legtöbb fejlesztő többféle adatbázissal dolgozik. DBeaver 80+-t támogat, DataGrip ~53-at. Ez drasztikusan növelné a user base-t.

---

## Saved Queries / Snippet Library
> **Megjegyzés:** Jelenleg a `QueryStore` (Zustand) és a `queries` SQLite tábla már támogatja a query mentést. A UI továbbfejleszthető: mappa struktúra, tag-ek, import/export JSON-ként megosztáshoz.

## Transactional Data Editing with Diff Review
> **Megjegyzés:** Az inline editing (`results-grid.tsx`) már generál UPDATE/DELETE-et. A továbbfejlesztés: change buffering (nem azonnali commit), diff preview panel, és egyetlen tranzakcióban commitolás Cmd+S-re.

---

## Kutatási források

- [DataGrip Features](https://www.jetbrains.com/datagrip/features/)
- [DBeaver Features](https://dbeaver.io/features/)
- [TablePlus](https://tableplus.com/)
- [Beekeeper Studio](https://www.beekeeperstudio.io/)
- [Evil Martians: 100 Dev Tool Landing Pages Study](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- Reddit r/PostgreSQL, r/database, HN fejlesztői visszajelzések
- Bytebase, DbVisualizer, pgMustard összehasonlító cikkek
