import { Typography } from "antd";
import type { QueryResult } from "../../types";

import "./results.css";

export interface DbmsOutputPanelProps {
  result: QueryResult;
}

export function DbmsOutputPanel({ result }: DbmsOutputPanelProps) {
  const lines = result.dbmsOutputLines ?? [];
  if (lines.length === 0) {
    return (
      <Typography.Text type="secondary" className="result-dbms-empty">
        No DBMS_OUTPUT for this execution.
      </Typography.Text>
    );
  }
  return (
    <pre className="result-dbms-lines">
      {lines.map((line, i) => (
        <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
      ))}
    </pre>
  );
}
