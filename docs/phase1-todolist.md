# Phase 1 - Foundation: Detailed Task List

> Timeline: Week 1-2
> Goal: Scaffolding project, connect Oracle, execute SQL, hien thi ket qua co ban

---

## Task 1: Environment Setup & Project Scaffolding

- [x] **1.1** Cai dat Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- [x] **1.2** Chay `wails doctor` kiem tra Go, Node.js, GCC/MinGW san sang
- [x] **1.3** Khoi tao project: `wails init -n oracle_client_soft -t react-ts`
- [x] **1.4** Cau truc lai thu muc project theo plan (tao `internal/`, `docs/` folders)
- [x] **1.5** Cau hinh `wails.json` (app name, window size mac dinh 1400x900, title)
- [x] **1.6** Chay `wails dev` lan dau de xac nhan project build + chay duoc

**Ghi chu Task 1 (da lam):**

- Wails CLI: v2.12.0 tai `C:\Users\haquy\go\bin\wails.exe` (them vao PATH neu can).
- `wails doctor`: SUCCESS — WebView2, Node 24, npm OK. *Luu y:* CGO/GCC chua kiem tra cho godror — se can khi Task 3+.
- **1.3:** Thu muc repo khac rong (`docs/`, `.cursor/`) nen khong `init` truc tiep vao root. Da tao project vao `wails_staging/` roi **move** toan bo file len root `e:\RD\oracle_client_soft`, xoa folder tam.
- **1.4:** `docs/` da co san; da tao `internal/database/`, `internal/models/`, `internal/config/` (co `.gitkeep`).
- **1.5:** `wails.json`: `outputfilename` -> `oracle_client_soft`. `main.go`: Title `Oracle SQL Lite`, `Width` 1400, `Height` 900.
- **1.6:** Da xac nhan bang `wails build` thanh cong — `build\bin\oracle_client_soft.exe`. Hang ngay dung `wails dev` (hot reload frontend + backend).

---

## Task 2: Go Backend - Models & Config

- [x] **2.1** Tao `internal/models/connection.go` - struct `ConnectionConfig`
  ```go
  type ConnectionConfig struct {
      ID          string `json:"id"`
      Name        string `json:"name"`
      Host        string `json:"host"`
      Port        int    `json:"port"`
      ServiceName string `json:"serviceName"`
      SID         string `json:"sid"`
      Username    string `json:"username"`
      Password    string `json:"password"`
      Role        string `json:"role"`
  }
  ```
- [x] **2.2** Tao `internal/models/query.go` - struct `QueryResult`, `ColumnInfo`
  ```go
  type QueryResult struct {
      Columns  []ColumnInfo    `json:"columns"`
      Rows     [][]interface{} `json:"rows"`
      RowCount int64           `json:"rowCount"`
      ExecTime int64           `json:"execTimeMs"`
      Messages []string        `json:"messages"`
  }
  type ColumnInfo struct {
      Name     string `json:"name"`
      Type     string `json:"type"`
      Length   int64  `json:"length"`
      Nullable bool   `json:"nullable"`
  }
  ```
- [x] **2.3** Tao `internal/config/config.go` - Doc/Ghi connections vao JSON file
  - Luu tai `%APPDATA%/OracleSQLLite/connections.json`
  - Functions: `LoadConnections()`, `SaveConnections()`, `AddConnection()`, `DeleteConnection()`
  - Password encrypt/decrypt don gian bang AES (hoac de plaintext cho Phase 1, encrypt Phase 4)

**Ghi chu Task 2:**

- `ConnectionConfig` co them `Validate()` (name, host, port, username, serviceName|sid).
- `QueryResult` co them `HasMore` (JSON `hasMore`) cho phan trang sau.
- Config: file `connections.json` trong thu muc `UserConfigDir()/OracleSQLLite`, ghi atomic (`.tmp` + rename), `AddConnection` gan UUID neu `id` rong, cap nhat theo id neu trung; `DeleteConnection` bao loi neu `id` rong, khong bao loi neu id khong ton tai. Mat khau **plaintext** Phase 1, co comment trong code.

---

## Task 3: Go Backend - Connection Manager

- [x] **3.1** Them dependency godror: `go get github.com/godror/godror`
- [x] **3.2** Tao `internal/database/connection.go` - struct `ConnectionManager`
  - Map `connections map[string]*sql.DB` de quan ly nhieu connection
  - Map `activeConnID string` de theo doi connection dang active
- [x] **3.3** Implement `Connect(config ConnectionConfig) error`
  - Build connect string: `user/password@host:port/service_name`
  - Dung `godror.NewConnector()` + `sql.OpenDB()`
  - Set pool config: `SetMaxOpenConns(5)`, `SetMaxIdleConns(2)`, `SetConnMaxLifetime(30min)`
  - Ping de verify connection thanh cong
- [x] **3.4** Implement `Disconnect(connID string) error`
  - Goi `db.Close()`, xoa khoi map
- [x] **3.5** Implement `TestConnection(config ConnectionConfig) (string, error)`
  - Connect, chay `SELECT 1 FROM dual`, tra ve Oracle version string, dong connection
- [x] **3.6** Implement `GetActiveConnection() *sql.DB` helper
- [x] **3.7** Implement `ListConnections() []ConnectionConfig` - tra ve danh sach saved connections

**Ghi chu Task 3:**

- Easy Connect: `host:port/serviceOrSid?connect_timeout=15`. Ho tro `Role`: SYSDBA, SYSOPER, SYSBACKUP, SYSDG, SYSKM, SYSRAC, SYSASM (godror `AdminRole`).
- `Connect` bat buoc `cfg.ID` khac rong; neu da mo cung id thi dong pool cu roi mo lai. `SetActiveConnection`, `ActiveConnectionID`, `ConnectionByID`, `ConnectedIDs`, `CloseAll` bo sung de dung sau.
- `TestConnection`: doc `BANNER` tu `v$version`; neu khong co quyen thi fallback `SELECT 1 FROM dual` + message giai thich.
- **Build godror:** can `CGO_ENABLED=1`, **gcc** (MinGW-w64 / TDM-GCC) trong PATH, va **Oracle Instant Client** (ODPI-C). Neu chua cai, `go build ./...` se loi; `go build .` (chi main, chua import `internal/database`) van OK cho den Task 5.

---

## Task 4: Go Backend - Basic SQL Executor

- [x] **4.1** Tao `internal/database/executor.go` - struct `QueryExecutor`
- [x] **4.2** Implement `ExecuteQuery(connID, sql string, maxRows int) (*QueryResult, error)`
  - Dung `db.QueryContext()` voi `context.WithTimeout` (60s default)
  - Doc column metadata tu `rows.ColumnTypes()`
  - Fetch toi da `maxRows` dong (mac dinh 500)
  - Do thoi gian thuc thi (`time.Now()` truoc/sau)
  - Xu ly cac kieu du lieu Oracle: VARCHAR2, NUMBER, DATE, TIMESTAMP, CLOB, BLOB (convert sang string/number)
- [x] **4.3** Implement `ExecuteDML(connID, sql string) (*QueryResult, error)`
  - Dung `db.ExecContext()`
  - Tra ve `RowsAffected()`
  - KHONG auto-commit (de user quyet dinh Commit/Rollback)
- [x] **4.4** Implement phat hien loai statement don gian
  - Trim + uppercase -> check prefix: SELECT/WITH -> query, INSERT/UPDATE/DELETE/MERGE -> DML
  - BEGIN/DECLARE -> PL/SQL (Phase 2 se xu ly day du hon)
- [x] **4.5** Xu ly error messages tu Oracle (ORA-xxxxx) -> tra ve trong `Messages[]`

**Ghi chu Task 4:**

- `connID` rong -> dung **active connection** (`ActiveConnectionID`). `QueryExecutor` nhan `*ConnectionManager` qua constructor.
- `ClassifyStatement` export: bo qua comment dau `--` va `/* */`; `SELECT`/`WITH` -> query; `BEGIN`/`DECLARE` -> PL/SQL (Phase 1 `Execute` tra loi); con lai -> `Exec` (INSERT/UPDATE/DELETE/MERGE, DDL, CALL, TRUNCATE...).
- `ExecuteQuery`: `HasMore` true neu bi cat boi `maxRows`. O cell: `time.Time` -> RFC3339Nano; `[]byte` UTF-8 -> string, khong hop le -> base64; `godror.Number` -> string.
- Loi: `(*QueryResult, error)` voi `err != nil` va `Messages[0] = err.Error()` (gom ORA-xxxxx).

---

## Task 5: Go Backend - App Service (Wails Bindings)

- [x] **5.1** Chinh sua `app.go` - tao struct `App` chua tat ca services
  ```go
  type App struct {
      ctx      context.Context
      connMgr  *database.ConnectionManager
      executor *database.QueryExecutor
  }
  ```
- [x] **5.2** Implement `startup(ctx)` - khoi tao services, load saved connections
- [x] **5.3** Implement `shutdown(ctx)` - dong tat ca connections
- [x] **5.4** Expose cac public methods cho frontend (Wails auto-bind):
  - `SaveConnection(config) error`
  - `GetSavedConnections() []ConnectionConfig`
  - `DeleteConnection(id) error`
  - `Connect(id) error`
  - `Disconnect(id) error`
  - `TestConnection(config) (string, error)`
  - `ExecuteSQL(connID, sql string, maxRows int) (*QueryResult, error)`
  - `GetActiveConnectionID() string`
- [x] **5.5** Update `main.go` - dang ky App struct voi Wails, cau hinh window options

**Ghi chu Task 5:**

- Khong dung `*config.AppConfig` rieng: package `internal/config` giu ham `LoadConnections` / `AddConnection` / `DeleteConnection` nhu Task 2.
- `DeleteConnection` + dong pool: goi `config.DeleteConnection` roi `connMgr.Disconnect`.
- `Connect(id)`: load profile tu file, `connMgr.Connect(cfg)` (profile phai co san id).
- `frontend/wailsjs/go/main/App.{js,d.ts}` da cap nhat **thu cong** vi `wails build` can CGO/godror; sau khi cai MinGW + Instant Client, chay lai `wails build` de ghi de bindings (hoac giu file neu da khop).
- `App.tsx` tam bot template `Greet` de tranh import thieu.

---

## Task 6: Frontend - Setup & Dependencies

- [x] **6.1** Cai dat npm dependencies:
  ```
  npm install @monaco-editor/react antd @ant-design/icons zustand allotment
  ```
- [x] **6.2** Cau hinh Ant Design - import CSS, cau hinh theme (dark theme mac dinh)
- [x] **6.3** Tao `frontend/src/types/index.ts` - TypeScript interfaces tuong ung Go structs
  ```typescript
  interface ConnectionConfig { id, name, host, port, serviceName, sid, username, password, role }
  interface QueryResult { columns, rows, rowCount, execTimeMs, messages }
  interface ColumnInfo { name, type, length, nullable }
  ```
- [x] **6.4** Tao `frontend/src/stores/connectionStore.ts` (Zustand)
  - State: `connections[]`, `activeConnectionId`, `isConnected`, `connectionStatus`
  - Actions: `loadConnections`, `connect`, `disconnect`, `saveConnection`, `deleteConnection`
- [x] **6.5** Tao `frontend/src/stores/editorStore.ts` (Zustand)
  - State: `tabs[]`, `activeTabId`, `results` (map tabId -> QueryResult)
  - Actions: `addTab`, `closeTab`, `setActiveTab`, `updateContent`, `setResult`

**Ghi chu Task 6:**

- Ant Design **6.x** (CSS-in-JS); `main.tsx` bọc `ConfigProvider` + `theme.darkAlgorithm`, `cssVar`, token `colorPrimary` / `borderRadius`. **Allotment** style: `import "allotment/dist/style.css"`.
- `types/index.ts`: them `hasMore` cho `QueryResult`, `EditorTab`, `ConnectionStatus`; `editorStore` co them `renameTab` (Task 7 double-click title).
- `connectionStore`: them `connectionError`, `syncActiveFromBackend`; `disconnect()` co the goi khong `id` (dung active).
- Monaco da cai; cau hinh Vite worker (neu can) o Task 9 khi gan editor.

---

## Task 7: Frontend - Application Layout

- [x] **7.1** Tao `frontend/src/components/Layout/AppLayout.tsx`
  - Su dung `allotment` (split panels): Sidebar (250px) | Main Area
  - Main Area chia doc: Editor (60%) | Results (40%)
  - Responsive, resizable bang keo tha
- [x] **7.2** Tao `frontend/src/components/Layout/Sidebar.tsx`
  - Hien thi danh sach connections (Phase 1: list don gian, Phase 2 se co tree)
  - Nut "New Connection" mo dialog
  - Hien thi trang thai connected/disconnected (icon mau)
- [x] **7.3** Tao `frontend/src/components/Layout/StatusBar.tsx`
  - Hien thi: Connection name | Row count | Execution time | Connection status
  - Fixed bottom, height 28px
- [x] **7.4** Update `App.tsx` - wrap AppLayout voi Ant Design ConfigProvider (dark theme)

**Ghi chu Task 7:**

- `AppLayout`: Allotment ngang — sidebar `preferredSize` 260px; main — Allotment doc 60%/40%: `EditorPanel` + `ResultPanel` (Task 10).
- `layout.css`: token ant (`--ant-*`) de dong bo dark theme.
- `Sidebar`: `loadConnections` on mount; `ConnectionList` + `ConnectionDialog` (Task 8); icon xanh khi profile = active + `isConnected`; double-click = connect; context menu = Connect / Edit / Delete.
- `main.tsx`: them `<AntdApp>` trong `ConfigProvider` de `Sidebar` dung `AntdApp.useApp()` (message).
- `style.css`: `#root` full height, `text-align: start`.

---

## Task 8: Frontend - Connection Dialog

- [x] **8.1** Tao `frontend/src/components/Connection/ConnectionDialog.tsx`
  - Ant Design Modal + Form
  - Fields: Connection Name, Host, Port (default 1521), Service Name/SID (radio toggle), Username, Password, Role (dropdown: Normal/SYSDBA/SYSOPER)
  - Nut "Test Connection" - goi Go TestConnection, hien ket qua
  - Nut "Save" - goi Go SaveConnection
  - Nut "Connect" - save + connect ngay
- [x] **8.2** Tao `frontend/src/components/Connection/ConnectionList.tsx`
  - List connections trong Sidebar
  - Moi item: icon + name + status
  - Double-click: connect
  - Right-click context menu: Connect, Edit, Delete
- [x] **8.3** Integrate dialog voi connectionStore

**Ghi chu Task 8:**

- `SaveConnection` (Go) tra ve `ConnectionConfig` da luu (co `id` moi khi tao) de nut **Connect** goi `connect(saved.id)` ngay sau khi save.
- `connectionStore.saveConnection` tra ve profile tu Wails, reload danh sach sau khi ghi file.
- `ConnectionDialog`: sua mat khau trong form de trong khi **Edit** thi giu mat khau cu tren disk; Alert hien ket qua Test (version / loi).
- `ConnectionList`: context menu (Ant Design Dropdown), xoa co `modal.confirm`; sap xep ten profile theo bang chu cai.
- `App.d.ts` / `App.js`: cap nhat kieu tra ve `SaveConnection`; sau khi co CGO/Instant Client, `wails build` co the ghi de bindings — can khoi phuc tuple return neu can.

---

## Task 9: Frontend - Monaco SQL Editor

- [x] **9.1** Tao `frontend/src/components/Editor/SQLEditor.tsx`
  - Import `@monaco-editor/react` Editor component
  - Language: `sql` (built-in Monaco SQL support)
  - Theme: `vs-dark` (dark mode)
  - Options: fontSize 14, minimap off, lineNumbers on, wordWrap on, scrollBeyondLastLine off
- [x] **9.2** Tao `frontend/src/components/Editor/EditorTabs.tsx`
  - Ant Design Tabs component
  - Tab management: add new tab (+), close tab (x), rename tab (double-click)
  - Moi tab luu noi dung SQL rieng (trong editorStore)
- [x] **9.3** Tao `frontend/src/components/Editor/EditorToolbar.tsx`
  - Toolbar phia tren editor:
  - Buttons: Run (play icon), Stop, Commit, Rollback
  - Connection selector dropdown (chon connection cho tab hien tai)
  - Keyboard shortcut hint text
- [x] **9.4** Implement Execute function:
  - Lay noi dung editor (hoac selected text neu co)
  - Goi Wails binding `ExecuteSQL(connID, sql, 500)`
  - Luu result vao editorStore
  - Hien thi loading spinner khi dang execute
- [x] **9.5** Bind keyboard shortcut `Ctrl+Enter` -> Execute trong Monaco editor

**Ghi chu Task 9:**

- `setupMonaco.ts` + import dau `main.tsx`: `loader.config({ monaco })` va Vite worker `editor.worker?worker` cho Monaco trong Wails/Vite.
- `EditorPanel.tsx` gom Toolbar + `EditorTabs` (an vung content tab, chi hien thanh tab) + `SQLEditor` (`key={activeTabId}` de tach buffer theo tab).
- `EditorTab.connectionId` + `setTabConnection`: dropdown **Active connection** = `connID` rong tren Go (dung pool dang active). `executeLoading` trong `editorStore`.
- **Stop**: nut tat, tooltip Phase 2 (chua co cancel query phia Go).
- **Commit** / **Rollback**: them `QueryExecutor.Commit` / `Rollback` + `App.Commit` / `App.Rollback` (Exec `COMMIT` / `ROLLBACK`); han che pool `sql.DB` — giao dich nhieu lenh tren cung session se mo rong sau.
- Bindings: `App.js` / `App.d.ts` them `Commit`, `Rollback`.

---

## Task 10: Frontend - Result Panel

- [x] **10.1** Tao `frontend/src/components/Results/ResultPanel.tsx`
  - Ant Design Tabs: "Results" | "Messages"
  - Hien thi tuong ung voi tab editor dang active
- [x] **10.2** Tao `frontend/src/components/Results/DataGrid.tsx`
  - Dung Ant Design Table (Phase 1, chuyen sang AG Grid o Phase 2)
  - Render columns tu `QueryResult.columns`
  - Render rows tu `QueryResult.rows`
  - Hien thi NULL values voi style khac biet (mau xam, italic "(null)")
  - Scroll doc cho nhieu dong
  - Hien thi row count va execution time o footer
- [x] **10.3** Tao `frontend/src/components/Results/MessagesPanel.tsx`
  - Hien thi `QueryResult.messages[]`
  - Hien thi ORA errors voi mau do
  - Hien thi success messages voi mau xanh
  - Timestamp cho moi message
- [x] **10.4** State management: khi execute xong, tu dong switch sang tab "Results" (neu SELECT) hoac "Messages" (neu DML/error)

**Ghi chu Task 10:**

- `editorStore.applyExecutionResult`: mot lan `set` — `results`, `resultReceivedAt`, `resultSubTabByTab` (dung `pickResultSubTab` trong `utils/queryResult.ts`).
- `resultSubTabByTab` + mac dinh: co grid -> Results; DML / loi / khong cot -> Messages. `ResultPanel` ep ve Messages neu luu Results nhung ket qua khong co cot.
- `MessagesPanel`: thoi gian thuc thi (locale time) lap lai truoc moi dong trong cung mot batch; ORA-* do, thong bao thanh cong (row affected/returned, …) xanh.
- `DataGrid`: cot `c0,c1,…` tranh trung `dataIndex`; footer rowCount + execTimeMs + truncated neu `hasMore`.
- `layout.css`: `.pane-results` thay placeholder; `results.css` cho bang va messages.

---

## Task 11: Integration & Testing

- [ ] **11.1** Ket noi end-to-end: Frontend -> Wails binding -> Go backend -> Oracle DB
- [ ] **11.2** Test kich ban: Mo app -> Tao connection -> Test connection -> Connect -> Viet SQL -> Execute -> Xem ket qua
- [ ] **11.3** Test error cases: Sai password, Oracle down, SQL syntax error, timeout
- [ ] **11.4** Test voi cac kieu du lieu: VARCHAR2, NUMBER, DATE, TIMESTAMP, NULL values
- [ ] **11.5** Kiem tra memory usage (target: < 80MB khi idle)
- [ ] **11.6** Fix bugs va polish UI co ban

---

## Tong ket Phase 1

| # | Task | Estimate |
|---|------|----------|
| 1 | Environment Setup & Scaffolding | 2h |
| 2 | Go Models & Config | 2h |
| 3 | Go Connection Manager | 4h |
| 4 | Go SQL Executor | 4h |
| 5 | Go App Service (Wails Bindings) | 2h |
| 6 | Frontend Setup & Dependencies | 1h |
| 7 | Frontend Application Layout | 3h |
| 8 | Frontend Connection Dialog | 3h |
| 9 | Frontend Monaco SQL Editor | 4h |
| 10 | Frontend Result Panel | 3h |
| 11 | Integration & Testing | 4h |
| **Total** | | **~32h (4 ngay lam viec)** |

---

## Definition of Done - Phase 1

Khi Phase 1 hoan thanh, app phai co the:

1. Khoi dong app Wails, hien thi giao dien voi layout Sidebar | Editor | Results
2. Tao va luu connection moi (host, port, service name, username, password)
3. Test connection thanh cong, hien thi Oracle version
4. Connect/Disconnect toi Oracle database
5. Viet SQL trong Monaco editor (co syntax highlighting)
6. Execute SELECT query bang Ctrl+Enter, hien thi ket qua trong data grid
7. Execute DML (INSERT/UPDATE/DELETE), hien thi affected rows trong Messages
8. Hien thi Oracle error messages khi SQL sai
9. Ho tro nhieu tabs editor
10. Dark theme giao dien
