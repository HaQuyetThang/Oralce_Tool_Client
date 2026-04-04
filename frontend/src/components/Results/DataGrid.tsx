import { useMemo } from "react";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ColumnInfo, QueryResult } from "../../types";

import "./results.css";

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <Typography.Text type="secondary" className="result-cell-null" italic>
        (null)
      </Typography.Text>
    );
  }
  if (typeof value === "object") {
    return (
      <span className="result-cell-json">{JSON.stringify(value)}</span>
    );
  }
  return <span className="result-cell-text">{String(value)}</span>;
}

export interface DataGridProps {
  result: QueryResult;
}

export function DataGrid({ result }: DataGridProps) {
  const columnsMeta = result.columns ?? [];
  const rows = result.rows ?? [];

  const { columns, dataSource } = useMemo(() => {
    const cols: ColumnsType<Record<string, unknown>> = columnsMeta.map(
      (c: ColumnInfo, i: number) => {
        const key = `c${i}`;
        return {
          title: c.name,
          dataIndex: key,
          key,
          ellipsis: true,
          render: (v: unknown) => <CellValue value={v} />,
        };
      }
    );
    const data = rows.map((row, ri) => {
      const rec: Record<string, unknown> = { key: ri };
      columnsMeta.forEach((_, ci) => {
        rec[`c${ci}`] = row[ci];
      });
      return rec;
    });
    return { columns: cols, dataSource: data };
  }, [columnsMeta, rows]);

  if (columnsMeta.length === 0) {
    return (
      <div className="result-data-grid-empty">
        <Typography.Text type="secondary">No columns to display</Typography.Text>
      </div>
    );
  }

  return (
    <div className="result-data-grid">
      <Table<Record<string, unknown>>
        size="small"
        bordered
        pagination={false}
        columns={columns}
        dataSource={dataSource}
        scroll={{ x: "max-content", y: 320 }}
        className="result-data-grid-table"
        footer={() => (
          <span className="result-data-grid-footer">
            {result.rowCount} row(s) · {result.execTimeMs} ms
            {result.hasMore ? " · truncated" : ""}
          </span>
        )}
      />
    </div>
  );
}
