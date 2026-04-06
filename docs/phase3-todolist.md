# Phase 3 - Autocomplete & Intelligence: Detailed Task List

> Timeline: Week 5 (theo [plan.md](plan.md) §7)
> Goal: Autocomplete tĩnh (keyword/hàm/kiểu/PL-SQL), autocomplete động theo schema có cache, gợi ý sau dấu chấm (cột), heuristic theo ngữ cảnh cơ bản, và **format SQL** (`sql-formatter`).

**Tham chiếu:** [plan.md](plan.md) §5.1 (Monaco + CompletionItemProvider), §6 (hai lớp autocomplete + cache), §7 Phase 3, §8 (dependencies); [phase2-todolist.md](phase2-todolist.md) (API dictionary + `schemaStore` đã sẵn).

**Tiền đề Phase 2:** [app.go](../app.go) đã expose `GetSchemas`, `GetTables`, `GetViews`, `GetMaterializedViews`, `GetColumns`, `GetProcedures`, `GetFunctions`, `GetSynonyms`, …; [schemaStore.ts](../frontend/src/stores/schemaStore.ts) có `fetch` / `invalidateConnection`; [SQLEditor.tsx](../frontend/src/components/Editor/SQLEditor.tsx) chưa đăng ký provider.

---

## Task 1: Static completion data (Layer 1)

- [x] **1.1** Tạo module dữ liệu tĩnh (vd `frontend/src/editor/oracleSqlStaticCompletions.ts` hoặc tương đương):
  - Oracle SQL keywords (SELECT, FROM, WHERE, GROUP BY, CONNECT BY, …)
  - Built-in functions (NVL, NVL2, DECODE, TO_DATE, TO_CHAR, SUBSTR, …)
  - PL/SQL keywords (DECLARE, BEGIN, END, EXCEPTION, LOOP, …)
  - Kiểu dữ liệu (VARCHAR2, NUMBER, DATE, CLOB, BLOB, …)
- [x] **1.2** Xuất hàm hoặc mảng `monaco.languages.CompletionItem[]` (hoặc builder) để provider merge với kết quả động

**Ghi chú Task 1:**

- Giữ danh sách có thể mở rộng; tránh bundle quá nặng (chia file nếu cần).
- Chỉnh `detail`/`documentation` ngắn cho vài hàm thường dùng (optional).
- **Đã làm:** [oracleSqlStaticCompletions.ts](../frontend/src/editor/oracleSqlStaticCompletions.ts) — `getOracleStaticCompletions()` + type `OracleStaticCompletionItem` (`range` để Task 2 gắn từ vị trí con trỏ); preload trong [setupMonaco.ts](../frontend/src/setupMonaco.ts).

---

## Task 2: Monaco — đăng ký CompletionItemProvider

- [x] **2.1** Đăng ký `monaco.languages.registerCompletionItemProvider('sql', …)` — có thể trong [setupMonaco.ts](../frontend/src/setupMonaco.ts) hoặc file riêng được import từ `main.tsx`
- [x] **2.2** `triggerCharacters`: tối thiểu `.`, và ký tự hợp lý cho từ (tuỳ Monaco; thường provider vẫn chạy khi gõ Ctrl+Space)
- [x] **2.3** Implement `provideCompletionItems(model, position, …)`: async (return `Promise` hoặc dùng `suggestions` với delayed resolve — theo pattern Monaco)
- [x] **2.4** Truyền **connection ID** giống execute: `tab.connectionId || activeConnectionId` — cần callback/getter từ [EditorPanel.tsx](../frontend/src/components/Editor/EditorPanel.tsx) → [SQLEditor.tsx](../frontend/src/components/Editor/SQLEditor.tsx) (hoặc Context) để provider luôn đọc đúng tab active
- [x] **2.5** Khi `connId` rỗng: chỉ trả static; không gọi Wails

**Ghi chú Task 2:**

- Tránh đăng ký provider trùng lần mỗi lần mount tab: register **một lần** toàn app hoặc dispose đúng lifecycle.
- Xử lý lỗi Wails: log nhẹ + fallback static.
- **Đã làm:** [registerOracleSqlCompletionProvider.ts](../frontend/src/editor/registerOracleSqlCompletionProvider.ts) + [sqlCompletionContext.ts](../frontend/src/editor/sqlCompletionContext.ts) (`getSqlCompletionConnectionId` qua `useEditorStore`/`useConnectionStore` `getState`). Gọi từ [setupMonaco.ts](../frontend/src/setupMonaco.ts). Gắn `range` từ `getWordAtPosition` / vị trí con trỏ; chưa gọi Wails (Task 3).

---

## Task 3: Dynamic lists (Layer 2) + `schemaStore`

- [x] **3.1** Key cache completion rõ ràng, không đụng nhầm key cây schema — vd prefix `${connId}\0completion\0…`
- [x] **3.2** Gợi ý **schema** qua `GetSchemas`
- [x] **3.3** Gợi ý **bảng / view / materialized view** qua `GetTables`, `GetViews`, `GetMaterializedViews` theo `owner/schema` đang target (xem Task 3.6)
- [x] **3.4** (Tùy chọn ưu tiên thấp) Gộp **synonym / procedure / function** (`GetSynonyms`, `GetProcedures`, `GetFunctions`) vào suggestion khi prefix phù hợp hoặc sau từ khóa `CALL`/`EXECUTE`
- [x] **3.5** Khi **Disconnect** hoặc **invalidateConnection**: xóa cache completion cho connection đó (mở rộng store hoặc gọi `invalidateConnection` đã có nếu key cùng prefix)
- [x] **3.6** **Chọn schema mặc định** cho object list: MVP có thể dùng schema đầu tiên từ `GetSchemas`, hoặc user hiện tại (document hành vi); sau này có thể đồng bộ với node đang chọn trên cây

**Ghi chú Task 3:**

- Backend đã đủ; Phase 3 chủ yếu frontend.
- `(Tùy chọn)` Nếu latency cao: debounce hoặc batch (Phase 3 không bắt buộc API Go mới).
- **Đã làm:** [sqlCompletionDynamic.ts](../frontend/src/editor/sqlCompletionDynamic.ts), [sqlCompletionKeys.ts](../frontend/src/editor/sqlCompletionKeys.ts) — `schemaListCacheKey` = `${connId}\0schemas` (chung cache với [SchemaTree.tsx](../frontend/src/components/Schema/SchemaTree.tsx)); rel/extras dùng `${connId}\0completion\0…`. Default schema: trùng `username` connection (uppercase) nếu có trong list, không thì tên đầu sau sort. Task 3.4: proc/func/synonym khi dòng trước cursor kết thúc bằng `CALL` / `EXEC` / `EXECUTE`.

---

## Task 4: Dot-completion — cột theo bảng / alias

- [x] **4.1** Parse identifier **trước dấu `.`** tại dòng cursor (scan ngược + regex)
- [x] **4.2** Map **alias → bảng** cơ bản từ phần `FROM` / `JOIN` của script (heuristic trong phạm vi hợp lý: cùng file, có thể giới hạn độ dài hoặc khối gần cursor)
- [x] **4.3** Resolve `schema` + `table` rồi gọi `GetColumns` qua `schemaStore.fetch` — cache theo `(connId, schema, table)` tới khi refresh/disconnect
- [x] **4.4** Trả về suggestion kiểu cột (có thể kèm datatype làm `detail`)

**Ghi chú Task 4:**

- CTE / subquery lồng nhau: ghi chú giới hạn MVP trong file này; không cần parser hoàn chỉnh ngay.
- Tên bảng có `schema.table`: tách owner đúng trước khi gọi `GetColumns`.
- **Đã làm:** [sqlCompletionDot.ts](../frontend/src/editor/sqlCompletionDot.ts) — qualifier `schema.table` / alias / bảng; chunk ~16k ký tự trước cursor, cắt sau `;` cuối; FROM + danh sách tách bởi `,` (ngoặc đơn); JOIN lặp strip; cache `columnsCacheKey`. [sqlCompletionSchema.ts](../frontend/src/editor/sqlCompletionSchema.ts) — `pickDefaultSchema` / `getDefaultSchemaForConnection` dùng chung Task 3. Provider: cột trước, rồi static; không match dot → luồng Task 3 như cũ.

---

## Task 5: Context-aware (heuristic)

- [x] **5.1** Dựa trên text trước cursor (token/từ khóa gần nhất): ưu tiên hoặc lọc nhóm suggestion — vd sau `FROM`/`JOIN` ưu tiên object; sau `SELECT` ưu tiên cột (nếu biết bảng từ FROM) + hàm + `*`
- [x] **5.2** Sau `WHERE` / `AND` / `OR`: ưu tiên cột khi có ngữ cảnh bảng
- [x] **5.3** Nhận diện khối **PL/SQL** đơn giản (`DECLARE`/`BEGIN`…): thêm ưu tiên keyword PL/SQL static; biến bind/local (optional / defer)

**Ghi chú Task 5:**

- Mục tiêu “đủ tốt cho daily use”, không cần parity SQL Developer trong Phase 3.
- **Đã làm:** [sqlCompletionSituation.ts](../frontend/src/editor/sqlCompletionSituation.ts) (từ khóa cuối trong chunk trước cursor); [sqlCompletionRanking.ts](../frontend/src/editor/sqlCompletionRanking.ts) (`sortText` tier); [sqlCompletionFromColumns.ts](../frontend/src/editor/sqlCompletionFromColumns.ts) — cột từ mọi bảng trong `FROM` (tối đa 12 bảng, cache `columnsCacheKey`); `*` khi `select_list`. Dot-completion cũng qua ranking. PL/SQL: ưu tiên keyword, hạ object.

---

## Task 6: Prefetch nền sau connect

- [x] **6.1** Sau khi **Connect** thành công ([connectionStore.ts](../frontend/src/stores/connectionStore.ts)): background prefetch tên **table + view** (và MV nếu nhẹ) cho schema mặc định (Task 3.6), đẩy vào `schemaStore` — không chặn UI
- [x] **6.2** Tránh prefetch trùng nếu user connect/disconnect nhanh (kiểm tra `connId` hợp lệ trước khi ghi cache)

**Ghi chú Task 6:**

- Khớp chiến lược [plan.md](plan.md) §6 (fetch khi connect + cache).
- **Đã làm:** [sqlCompletionPrefetch.ts](../frontend/src/editor/sqlCompletionPrefetch.ts) — `GetSchemas` + bundle `rel` (tables/views/MV) giống Task 3; `GetActiveConnectionID` trước/sau await và trong fetcher; hủy nội bộ nếu `active !== id` (không ghi cache rel).

---

## Task 7: SQL Format (`sql-formatter`)

- [x] **7.1** Thêm dependency `sql-formatter` vào [frontend/package.json](../frontend/package.json), chạy `npm install` trong `frontend/`
- [x] **7.2** Nút **Format** trên [EditorToolbar.tsx](../frontend/src/components/Editor/EditorToolbar.tsx) (hoặc menu): format toàn buffer hoặc vùng chọn — cập nhật model Monaco / `updateContent` store
- [x] **7.3** Chọn dialect phù hợp (vd `plsql` / `sql` theo tài liệu thư viện); test nhanh với `SELECT` đơn và khối PL/SQL
- [x] **7.4** (Tùy chọn) Phím tắt format nếu không xung đột OS

**Ghi chú Task 7:**

- Format có thể thay đổi whitespace/chữ hoa — không auto-format on save trừ khi chủ động yêu cầu sau này.
- **Đã làm:** [sqlFormatter.ts](../frontend/src/utils/sqlFormatter.ts) (`language: 'plsql'`), nút Format + `formatSql` / `executeEdits` trong [SQLEditor.tsx](../frontend/src/components/Editor/SQLEditor.tsx), wiring [EditorPanel.tsx](../frontend/src/components/Editor/EditorPanel.tsx); phím **Shift+Alt+F** (giống VS Code).

---

## Task 8: Integration, testing & Definition of Done

- [ ] **8.1** Đã connect: Ctrl+Space / gõ — có static + object sau prefetch
- [ ] **8.2** `schema.table.` hoặc `alias.` — cột hiện khi resolve được
- [ ] **8.3** Đổi tab worksheet (connection khác) — suggestion dùng đúng `connId`
- [ ] **8.4** Disconnect — không crash; completion chỉ còn static
- [ ] **8.5** Refresh schema tree (nếu invalidate cache) — completion object/cột khớp kỳ vọng sau reload
- [ ] **8.6** Format không làm mất nội dung; undo (Monaco) vẫn dùng được sau format
- [ ] **8.7** (Khuyến nghị) Ghi chú ngắn trong [kien-truc-du-an.md](kien-truc-du-an.md) về completion + format (nếu file tồn tại và team dùng)

**Ghi chú Task 8:**

- So với Phase 2 Task 10: tập trung regression trên editor + store, không lặp test grid.

---

## Tổng kết Phase 3 (ước lượng)

| # | Task | Estimate |
|---|------|----------|
| 1 | Static completions | 2–4h |
| 2 | Monaco provider + wiring connId | 2–4h |
| 3 | Dynamic lists + cache keys | 4–8h |
| 4 | Dot + alias map | 6–12h |
| 5 | Context heuristics | 4–8h |
| 6 | Prefetch on connect | 1–2h |
| 7 | sql-formatter + toolbar | 1–3h |
| 8 | Integration & testing | 4–6h |
| **Total** | | **~24–47h (~3–6 ngày làm việc)** |

*(Tuỳ độ phức tạp alias/parser và số object type động: có thể lệch ±.)*

---

## Definition of Done - Phase 3

Khi Phase 3 hoàn thành, app phải có thể:

1. Gõ trong Monaco và nhận **gợi ý keyword/hàm/kiểu** (static) không cần DB.
2. Khi **đã kết nối**, nhận gợi ý **schema / bảng / view** (và MV) từ DB với **cache** qua `schemaStore`, không làm đơ UI nhờ prefetch/pattern async hợp lý.
3. Gõ **`alias.`** hoặc **`table.`** (và trường hợp `schema.table.`) và nhận gợi ý **cột** khi resolve được bảng (trong phạm vi heuristic đã ghi nhận).
4. Có **heuristic ngữ cảnh** cơ bản (FROM vs WHERE…) để ưu tiên đúng nhóm suggestion.
5. Có nút (và/hoặc shortcut) **Format SQL** dựa trên `sql-formatter`, hoạt động ổn trên worksheet đang mở.

---

*Tài liệu này bám [plan.md](plan.md) Phase 3. Export/Import, Explain Plan, DDL viewer đầy đủ thuộc Phase 4.*
