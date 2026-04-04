import "./setupMonaco";
import React from "react";
import { createRoot } from "react-dom/client";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import "allotment/dist/style.css";
import "./style.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        cssVar: { key: "oracle-sql-lite" },
        token: {
          colorPrimary: "#3c89f5",
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
