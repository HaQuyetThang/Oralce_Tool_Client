import { List, Typography } from "antd";
import type { QueryResult } from "../../types";

import "./results.css";

const ORA_RE = /ORA-\d+/i;

function classifyLine(text: string): "error" | "success" | "neutral" {
  if (ORA_RE.test(text)) {
    return "error";
  }
  const lower = text.toLowerCase();
  if (
    lower.includes("row(s) affected") ||
    lower.includes("row(s) returned") ||
    lower.includes("connected") ||
    lower.includes("success")
  ) {
    return "success";
  }
  return "neutral";
}

function formatTs(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export interface MessagesPanelProps {
  result: QueryResult;
  receivedAt: number;
}

export function MessagesPanel({ result, receivedAt }: MessagesPanelProps) {
  const lines = result.messages?.filter(Boolean) ?? [];
  const ts = formatTs(receivedAt);

  if (lines.length === 0) {
    return (
      <div className="result-messages-empty">
        <Typography.Text type="secondary">No messages</Typography.Text>
      </div>
    );
  }

  const items = lines.map((text, i) => ({ text, key: i }));

  return (
    <List
      className="result-messages-list"
      size="small"
      rowKey="key"
      dataSource={items}
      renderItem={(item) => {
        const kind = classifyLine(item.text);
        return (
          <List.Item className="result-messages-item">
            <Typography.Text
              type="secondary"
              className="result-messages-time"
              aria-hidden
            >
              [{ts}]
            </Typography.Text>{" "}
            <span
              className={
                kind === "error"
                  ? "result-msg-error"
                  : kind === "success"
                    ? "result-msg-success"
                    : "result-msg-neutral"
              }
            >
              {item.text}
            </span>
          </List.Item>
        );
      }}
    />
  );
}
