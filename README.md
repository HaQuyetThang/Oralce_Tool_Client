# Oracle SQL Lite

Ứng dụng desktop (Windows) để kết nối **Oracle Database**, quản lý profile kết nối, soạn SQL và xem kết quả — tương tự một “SQL client” gọn nhẹ, không thay thế đầy đủ DBA Studio.

## Mục đích

- Lưu nhiều **kết nối** (host, port, service name hoặc SID, user, role SYSDBA/SYSOPER…).
- **Kết nối** tới Oracle, **thử kết nối** trước khi lưu.
- Chạy **SELECT / WITH** (hiển thị lưới, giới hạn số dòng) và **DML/DDL** qua đường thực thi.
- **Commit** / **Rollback** trên session pool đang dùng.
- Soạn script trong **Monaco Editor**, nhiều tab worksheet.

Chi tiết kiến trúc và luồng dữ liệu: [`docs/kien-truc-du-an.md`](docs/kien-truc-du-an.md).

## Kiến trúc tổng quan

| Thành phần | Vai trò |
|------------|---------|
| **Wails v2** | Gộp backend Go + giao diện web trong cửa sổ native (WebView2). |
| **Go** | API gọi từ UI: lưu `connections.json`, quản lý pool `database/sql`, thực thi SQL qua **godror**. |
| **React + TypeScript + Vite** | UI: Ant Design, Zustand, Monaco; gọi method Go qua binding sinh ra trong `frontend/wailsjs/`. |

Luồng chính: React → Wails → struct `App` (`app.go`) → `internal/config` (file JSON) / `internal/database` (Oracle).

## Yêu cầu môi trường

- [Go](https://go.dev/dl/) (khớp `go.mod`, hiện 1.23+).
- [Node.js](https://nodejs.org/) + npm (để build frontend).
- [Wails CLI](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Oracle Instant Client** (godror cần thư viện client Oracle).
- Trên Windows: **WebView2** (thường có sẵn); toolchain **CGO** (ví dụ MinGW-w64 / MSYS2) để biên dịch godror.

Kiểm tra nhanh: `wails doctor`.

## Cài đặt

Mở terminal tại thư mục gốc của repository (folder chứa `go.mod`, `wails.json`).

Cài dependency frontend (lần đầu hoặc sau khi đổi `package.json`):

```bash
cd frontend
npm install
cd ..
```

Dependency Go:

```bash
go mod download
```

## Chạy phát triển

Từ thư mục gốc dự án:

```bash
wails dev
```

Frontend hot-reload qua Vite; backend Go được build lại khi cần. Binding TypeScript cập nhật khi thay đổi method public trên `App` trong Go.

## Build bản phát hành

```bash
wails build
```

Binary (ví dụ `build/bin/oracle_client_soft.exe` trên Windows) nhúng sẵn assets từ `frontend/dist`.

## Cấu hình & dữ liệu người dùng

- Cấu hình Wails: `wails.json`.
- Profile kết nối lưu tại thư mục cấu hình user, ví dụ Windows: `%APPDATA%\OracleSQLLite\connections.json` (mật khẩu Phase 1 đang lưu **plaintext** — xem `docs/kien-truc-du-an.md`).

## Tài liệu thêm

- [`docs/phase1-todolist.md`](docs/phase1-todolist.md) — checklist phase 1.
