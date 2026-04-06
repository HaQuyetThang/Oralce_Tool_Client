# Phase 2 - Core Features: Detailed Task List

> Timeline: Week 3-4 (theo [plan.md](plan.md) §7)
> Goal: Cây schema lazy-load đủ loại object, worksheet đa tab ổn định, lưới kết quả nâng cao (virtual scroll / copy / sort), tab Messages + **DBMS Output**, hủy truy vấn đang chạy, củng cố Commit/Rollback và PL/SQL.

**Tham chiếu:** [plan.md](plan.md) §4.2, §4.3, §5.2, §5.3; [phase1-todolist.md](phase1-todolist.md) (phần còn lại cho Phase 2); [kien-truc-du-an.md](kien-truc-du-an.md).

---

## Task 1: Go Backend - Schema Models

- [x] **1.1** Tạo `internal/models/schema.go` (hoặc tách file nhỏ) — struct JSON cho Wails, ví dụ:
  - `TableInfo`, `ColumnDetail`, `IndexInfo`, `ConstraintInfo` (khớp field cần hiển thị tree / detail)
  - Enum/string cho `objectType` khi gọi `GetDDL` (sau này dùng chung Phase 4)
- [x] **1.2** Cập nhật `frontend/src/types/index.ts` — mirror các type schema mới (đồng bộ tên field JSON với Go)

**Ghi chú Task 1:**

- Giữ struct gọn; tránh leak kiểu nội bộ driver vào JSON.
- Đặt tên field JSON `camelCase` thống nhất với các model hiện có (`QueryResult`, v.v.).

---

## Task 2: Go Backend - Schema Service (`internal/database/schema.go`)

- [x] **2.1** Tạo `SchemaService` (hoặc method trên service hiện có) nhận `*ConnectionManager`, resolve `*sql.DB` theo `connID` (cùng quy tắc rỗng = active như executor)
- [x] **2.2** Implement các truy vấn dictionary (theo plan §4.3), tham số hóa `owner` / `table_name`:
  - `GetSchemas(connID) ([]string, error)` — `ALL_USERS` (hoặc tương đương phù hợp quyền)
  - `GetTables`, `GetViews`, `GetMaterializedViews` (nếu có trong plan tree)
  - `GetColumns(connID, schema, table)`
  - `GetIndexes`, `GetConstraints` theo bảng
  - `GetProcedures`, `GetFunctions`, `GetPackages`, `GetSequences`, `GetTriggers`, `GetSynonyms`, `GetTypes` (theo cây §4.3 — có thể làm theo lô; object type nào chưa cần UI thì defer nhưng nên có stub hoặc ghi chú)
- [x] **2.3** `GetDDL(connID, schema, objectType, objectName) (string, error)` — `DBMS_METADATA.GET_DDL` (dùng cho Phase 2 optional “View DDL” hoặc chuẩn bị Phase 4)
- [x] **2.4** Xử lý lỗi Oracle (ORA-00942, insufficient privilege): trả message rõ, không crash pool

**Ghi chú Task 2:**

- Lazy load: mỗi API tương ứng một cấp expand trên cây; không prefetch toàn bộ schema.
- Quyền `ALL_*` vs `USER_*`: document trong ghi chú task khi test.
- **Đã làm:** `internal/database/schema.go` + `ConnectionManager.ResolveDB` dùng chung với executor. Trigger: `GetTriggersForSchema` / `GetTriggersForTable`. Lỗi trả về cho UI qua Wails như mọi API khác.

---

## Task 3: Go Backend - Executor Nâng Cao (PL/SQL, DBMS_OUTPUT, Cancel)

- [x] **3.1** Thêm `context.Context` có thể hủy cho đường chạy query dài: map `connID` → `cancel func` hoặc một `CancelQuery(connID) error` gọi cancel của operation đang chạy (theo plan §4.2)
- [x] **3.2** Implement `ExecutePLSQL(connID, block string) (*QueryResult, error)` (hoặc mở rộng `Execute` hiện tại):
  - Trước khi chạy block: `DBMS_OUTPUT.ENABLE` (buffer đủ lớn nếu cần)
  - Sau khi chạy: gom dòng qua `DBMS_OUTPUT.GET_LINES` (hoặc tương đương) → đưa vào field mới hoặc `messages` / slice riêng trong `QueryResult`
- [x] **3.3** Phân loại statement: `BEGIN`/`DECLARE` → PL/SQL path (thay cho Phase 1 “not supported”)
- [x] **3.4** Timeout: giữ `context.WithTimeout` (vd 60s) đồng bộ với query path; cancel từ UI gọi hủy context

**Ghi chú Task 3:**

- PL/SQL có thể không trả cột — UI tab Results / Messages / DBMS Output cần hợp nhất (Task 8).
- Kiểm tra race: một connection một query tại một thời điểm hoặc queue — ghi rõ trong code nếu giới hạn.
- **Đã làm:** `running` map + `opID` tránh so sánh `func`. PL/SQL dùng `sql.Conn` một session; `DBMS_OUTPUT` đọc bằng vòng lặp `GET_LINE` + `sql.Out`. `QueryResult.DbmsOutputLines` trong `internal/models/query.go`.

---

## Task 4: Go Backend - App Facade & Wails Bindings

- [x] **4.1** Trong `app.go`, inject `SchemaService`, expose các method public (tên ổn định cho frontend), ví dụ:
  - `GetSchemaList(connID)`, `GetTables(connID, schema)`, `GetViews(...)`, … (khớp Task 2)
  - `GetTableColumns`, `GetTableIndexes`, `GetTableConstraints`, …
  - `GetDDL(...)` nếu bật tính năng xem DDL ở Phase 2
- [x] **4.2** Expose `CancelQuery(connID string) error`
- [x] **4.3** Expose `ExecutePLSQL` hoặc mở rộng chữ ký `ExecuteSQL` — **một** đường vào rõ ràng cho frontend (tránh duplicate logic)
- [x] **4.4** Chạy `wails build` / generate để cập nhật `frontend/wailsjs/go/main/App.{js,d.ts}`

**Ghi chú Task 4:**

- Giữ pattern `connID` rỗng = active giống `ExecuteSQL` / Commit / Rollback.
- Sau khi đổi binding, kiểm tra import từ `wailsjs` trên toàn bộ frontend.
- **Đã làm:** `app.go` bọc toàn bộ method schema + `CancelQuery`. PL/SQL qua `ExecuteSQL` (không thêm API riêng). `App.js` / `App.d.ts` / `models.ts` cập nhật thủ công (đồng bộ với Phase 1).

---

## Task 5: Frontend - Dependencies & Chuẩn Bị Grid

- [x] **5.1** Cài đặt AG Grid (theo plan §8): `ag-grid-community` + `ag-grid-react` (phiên bản tương thích React 18 / Vite)
- [x] **5.2** Import style AG Grid (theme dark khớp Ant Design dark hiện tại)
- [x] **5.3** (Tùy chọn) Cấu hình Vite nếu cần cho worker / chunk — chỉ khi build lỗi *(chưa cần — `tsc` pass; `vite build` có thể chậm do AG Grid)*

**Ghi chú Task 5:**

- Plan cũng nêu TanStack Table — nếu team chọn TanStack thay AG Grid, ghi chú lại trong file này và điều chỉnh Task 8 cho khớp.

---

## Task 6: Frontend - `schemaStore` & Cache

- [x] **6.1** Tạo `frontend/src/stores/schemaStore.ts` (Zustand):
  - Key cache theo `connectionId` + path node (vd `schema|OWNER|tables|TABLE_NAME|columns`)
  - Actions: `invalidateConnection`, `invalidateSchema`, hoặc `clearAll`
- [x] **6.2** (Tùy chọn) Nút “Refresh” trên vùng cây schema gọi invalidate + reload node đang mở

**Ghi chú Task 6:**

- Chiến lược cache theo plan §6: fetch khi expand; invalidation khi user bấm refresh (manual).

---

## Task 7: Frontend - Schema Tree & Tích Hợp Sidebar

- [x] **7.1** Tạo `frontend/src/components/Schema/SchemaTree.tsx` — Ant Design `Tree`, `loadData` lazy
- [x] **7.2** Phân cấp nút khớp plan §4.3: Connection (đã connect) → Schema → nhóm object → object → (Columns / Indexes / Constraints / Triggers on table, …)
- [x] **7.3** Double-click tên bảng (hoặc node object): chèn tên vào editor worksheet đang active (theo plan §5.2)
- [x] **7.4** Tích hợp vào `Sidebar.tsx`: giữ danh sách connection Phase 1; khi đã connect, hiển thị `SchemaTree` cho connection active (hoặc theo connection đang chọn — thống nhất một UX)
- [ ] **7.5** **(Tùy chọn Phase 2)** Context menu: Table → “SELECT first 100”, “View DDL”, … — có thể hoãn sang Phase 4 nếu trùng “Table DDL viewer” trong plan §7 Phase 4

**Ghi chú Task 7:**

- Phase 1 ghi chú: “Phase 2 se co tree” — đây là task trọng tâm UI Phase 2.
- Drag-drop chèn danh sách cột (plan §5.2): đánh dấu optional nếu hết thời gian.

---

## Task 8: Frontend - Result Panel: DBMS Output & Grid Nâng Cao

- [x] **8.1** Mở rộng `QueryResult` / payload từ Go: field cho DBMS output (vd `dbmsOutputLines []string` hoặc quy ước trong `messages`) — đồng bộ TypeScript
- [x] **8.2** `ResultPanel.tsx`: thêm tab **“DBMS Output”** cạnh Results | Messages (plan §5.3)
- [x] **8.3** Sau khi execute PL/SQL (hoặc script có DBMS), tự chọn tab phù hợp (tương tự `pickResultSubTab` Phase 1)
- [x] **8.4** Thay `DataGrid.tsx` (Ant Table) bằng AG Grid (hoặc bọc component mới):
  - Virtual scrolling / xử lý tập lớn
  - Sort & filter phía client (theo plan §5.3)
  - Copy cell / row / column (context menu hoặc shortcut — ghi rõ trong UI)
  - NULL hiển thị `(null)` + style tách biệt (giữ hành vi Phase 1)
- [x] **8.5** Footer: row count, `execTimeMs`, cảnh báo `hasMore` nếu còn (đã có Phase 1 — port sang AG Grid)

**Ghi chú Task 8:**

- `MessagesPanel` Phase 1 giữ; bổ sung luồng DBMS riêng tab để không trộn lẫn ORA/info.

---

## Task 9: Frontend - Toolbar Stop & Quản Lý Tab / Transaction

- [x] **9.1** Bật nút **Stop**: gọi `CancelQuery` với `connID` đúng (active hoặc theo tab)
- [x] **9.2** Trạng thái loading: disable Run hoặc cho phép Stop; khi cancel xong, cập nhật message rõ ràng
- [x] **9.3** Rà soát **Commit** / **Rollback** với nhiều tab + `connectionId` trên tab — đồng bộ với Phase 1 (ghi chú Task 9 phase1); bổ sung test DML không autocommit *(logic giữ như Phase 1; xác nhận trên DB thật ở Task 10)*
- [x] **9.4** Polish multi-tab: xác nhận add/close/rename ổn định khi có schema tree + grid mới (không mất `results` map theo `tabId`) *(không đổi cấu trúc store `results`; kiểm tra tay Task 10)*

**Ghi chú Task 9:**

- Phase 1: Stop tooltip “Phase 2” — đóng bằng Task 9.1–9.2.

---

## Task 10: Integration, Testing & Definition of Done

- [ ] **10.1** Test end-to-end: Connect → expand schema → tables → columns (quyền đủ)
- [ ] **10.2** Test PL/SQL + `DBMS_OUTPUT.PUT_LINE` hiển thị tab DBMS Output
- [ ] **10.3** Test `CancelQuery` với `SELECT` chạy lâu (vd `FROM dual CONNECT BY`)
- [ ] **10.4** Test grid lớn (nhiều dòng/cột), scroll, sort, copy
- [ ] **10.5** Test lỗi quyền / object không tồn tại trên cây — UI không treo
- [ ] **10.6** (Khuyến nghị) Cập nhật [kien-truc-du-an.md](kien-truc-du-an.md) mục API Wails và mục “hướng mở rộng” khi Phase 2 xong

**Ghi chú Task 10:**

- Task 11 Phase 1 (integration) có thể chạy song song khi Phase 2 ổn định.

---

## Tổng kết Phase 2 (ước lượng)

| # | Task | Estimate |
|---|------|----------|
| 1 | Go Schema Models + TS types | 2h |
| 2 | Go Schema Service (dictionary) | 8h |
| 3 | Go Executor PL/SQL + DBMS_OUTPUT + Cancel | 8h |
| 4 | App Wails bindings + regenerate wailsjs | 2h |
| 5 | Frontend deps AG Grid | 1h |
| 6 | schemaStore + cache | 3h |
| 7 | SchemaTree + Sidebar | 10h |
| 8 | ResultPanel DBMS + AG Grid | 10h |
| 9 | Toolbar Stop + polish tab/transaction | 3h |
| 10 | Integration & testing | 6h |
| **Total** | | **~53h (~6–7 ngày làm việc)** |

*(Tùy chọn context menu / drag-drop cột / GET_DDL UI: cộng thêm 4–8h.)*

---

## Definition of Done - Phase 2

Khi Phase 2 hoàn thành, app phải có thể:

1. Sau khi **Connect**, sidebar hiển thị **cây schema** lazy-load: schema → các nhóm object chính (tables, views, …) → chi tiết con khi expand.
2. Double-click (hoặc thao tác tương đương) trên bảng để **chèn tên** vào editor đang mở.
3. Chạy **anonymous PL/SQL** và xem output **`DBMS_OUTPUT`** trên tab riêng.
4. **Hủy** truy vấn SELECT đang chạy lâu qua nút Stop (backend hủy context).
5. Lưới kết quả dùng **AG Grid** (hoặc giải pháp tương đương đã ghi chú): virtual scroll, sort/filter client, copy cell/row/column, NULL rõ ràng.
6. **Commit** / **Rollback** hoạt động nhất quán với connection đang dùng (kể cả khi chọn connection theo tab).
7. Đa tab worksheet vẫn ổn định với luồng execute / results / messages / DBMS mới.

---

*Tài liệu này bám [plan.md](plan.md) Phase 2; các hạng mục Export/Import, autocomplete đầy đủ, format SQL, Explain Plan thuộc Phase 3–4.*
