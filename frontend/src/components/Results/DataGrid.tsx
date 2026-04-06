import { useMemo } from "react";
import { Typography } from "antd";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetContextMenuItems,
  type GridReadyEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { ColumnInfo, QueryResult } from "../../types";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import "./results.css";

ModuleRegistry.registerModules([AllCommunityModule]);

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "(null)";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export interface DataGridProps {
  result: QueryResult;
}

export function DataGrid({ result }: DataGridProps) {
  const columnsMeta = result.columns ?? [];
  const rows = result.rows ?? [];

  const { colDefs, rowData } = useMemo(() => {
    const colDefs: ColDef<Record<string, unknown>>[] = columnsMeta.map(
      (c: ColumnInfo, i: number) => {
        const field = `c${i}`;
        return {
          field,
          headerName: c.name,
          sortable: true,
          filter: true,
          resizable: true,
          minWidth: 100,
          flex: 1,
          valueFormatter: (p) => cellText(p.value),
          cellClassRules: {
            "result-ag-cell-null": (p) =>
              p.value === null || p.value === undefined,
          },
        };
      }
    );
    const rowData = rows.map((row, ri) => {
      const rec: Record<string, unknown> = { _row: ri };
      columnsMeta.forEach((_, ci) => {
        rec[`c${ci}`] = row[ci];
      });
      return rec;
    });
    return { colDefs, rowData };
  }, [columnsMeta, rows]);

  const getContextMenuItems = useMemo<GetContextMenuItems>(() => {
    return (params) => {
      const def = params.defaultItems?.filter((x) => x !== "export") ?? [];
      const api = params.api;
      const colId = params.column?.getColId();
      const rowNode = params.node;
      return [
        ...def,
        {
          name: "Copy cell",
          action: () => {
            if (!colId || !rowNode) {
              return;
            }
            const v = rowNode.data?.[colId];
            void navigator.clipboard.writeText(cellText(v));
          },
        },
        {
          name: "Copy row (TSV)",
          action: () => {
            if (!rowNode?.data) {
              return;
            }
            const cells = colDefs
              .map((c) => c.field)
              .filter(Boolean)
              .map((f) => cellText(rowNode.data![f as string]));
            void navigator.clipboard.writeText(cells.join("\t"));
          },
        },
        {
          name: "Copy all rows (TSV)",
          action: () => {
            const lines: string[] = [];
            api.forEachNode((n) => {
              if (!n.data) {
                return;
              }
              const cells = colDefs
                .map((c) => c.field)
                .filter(Boolean)
                .map((f) => cellText(n.data![f as string]));
              lines.push(cells.join("\t"));
            });
            void navigator.clipboard.writeText(lines.join("\n"));
          },
        },
      ];
    };
  }, [colDefs]);

  const onGridReady = (e: GridReadyEvent) => {
    e.api.sizeColumnsToFit();
  };

  if (columnsMeta.length === 0) {
    return (
      <div className="result-data-grid-empty">
        <Typography.Text type="secondary">No columns to display</Typography.Text>
      </div>
    );
  }

  return (
    <div className="result-data-grid ag-theme-quartz-dark">
      <AgGridReact<Record<string, unknown>>
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
        }}
        getContextMenuItems={getContextMenuItems}
        onGridReady={onGridReady}
        rowHeight={32}
        headerHeight={36}
        animateRows
        domLayout="normal"
        className="result-ag-grid-inner"
      />
      <div className="result-data-grid-footer">
        {result.rowCount} row(s) · {result.execTimeMs} ms
        {result.hasMore ? " · truncated" : ""}
      </div>
    </div>
  );
}
