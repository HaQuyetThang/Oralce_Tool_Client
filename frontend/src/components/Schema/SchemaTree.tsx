import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Tree, Typography } from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import {
  GetColumns,
  GetConstraints,
  GetFunctions,
  GetIndexes,
  GetMaterializedViews,
  GetPackages,
  GetProcedures,
  GetSchemas,
  GetSequences,
  GetSynonyms,
  GetTables,
  GetTriggersForSchema,
  GetTriggersForTable,
  GetTypes,
  GetViews,
} from "../../../wailsjs/go/main/App";
import { useSchemaStore } from "../../stores/schemaStore";
import { useEditorStore } from "../../stores/editorStore";

const SEP = "___";

function joinKey(...parts: string[]): string {
  return parts.join(SEP);
}

function parseKey(key: string): string[] {
  return key.split(SEP);
}

function updateTreeData(
  list: DataNode[],
  targetKey: React.Key,
  children: DataNode[]
): DataNode[] {
  return list.map((node) => {
    if (node.key === targetKey) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, targetKey, children),
      };
    }
    return node;
  });
}

const SCHEMA_CATEGORIES: { title: string; suffix: string }[] = [
  { title: "Tables", suffix: "TABLES" },
  { title: "Views", suffix: "VIEWS" },
  { title: "Materialized views", suffix: "MATERIALIZED_VIEWS" },
  { title: "Procedures", suffix: "PROCEDURES" },
  { title: "Functions", suffix: "FUNCTIONS" },
  { title: "Packages", suffix: "PACKAGES" },
  { title: "Sequences", suffix: "SEQUENCES" },
  { title: "Triggers", suffix: "TRIGGERS_SCHEMA" },
  { title: "Synonyms", suffix: "SYNONYMS" },
  { title: "Types", suffix: "TYPES" },
];

const TABLE_SUB: { title: string; suffix: string }[] = [
  { title: "Columns", suffix: "COLUMNS" },
  { title: "Indexes", suffix: "INDEXES" },
  { title: "Constraints", suffix: "CONSTRAINTS" },
  { title: "Triggers", suffix: "TRIGGERS_TABLE" },
];

export interface SchemaTreeProps {
  connectionId: string;
}

export function SchemaTree({ connectionId }: SchemaTreeProps) {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const fetchCache = useSchemaStore((s) => s.fetch);
  const invalidateConnection = useSchemaStore((s) => s.invalidateConnection);
  const appendSqlToActiveTab = useEditorStore((s) => s.appendSqlToActiveTab);

  const cacheRoot = connectionId || "";

  const loadSchemas = useCallback(async () => {
    if (!connectionId) {
      setTreeData([]);
      return;
    }
    const key = `${cacheRoot}\0schemas`;
    try {
      const list = (await fetchCache(key, () =>
        GetSchemas(connectionId)
      )) as string[];
      const nodes: DataNode[] = (list ?? []).map((name) => ({
        title: name,
        key: joinKey("sch", name),
        isLeaf: false,
      }));
      setTreeData(nodes);
    } catch {
      setTreeData([]);
    }
  }, [connectionId, cacheRoot, fetchCache]);

  useEffect(() => {
    void loadSchemas();
  }, [loadSchemas]);

  const onRefresh = () => {
    invalidateConnection(connectionId);
    void loadSchemas();
  };

  const loadChildren = useCallback(
    async (nodeKey: string): Promise<DataNode[]> => {
      const p = parseKey(nodeKey);
      const kind = p[0];

      if (kind === "sch" && p.length === 2) {
        const schema = p[1];
        return SCHEMA_CATEGORIES.map((c) => ({
          title: c.title,
          key: joinKey("cat", schema, c.suffix),
          isLeaf: false,
        }));
      }

      if (kind === "cat" && p.length === 3) {
        const schema = p[1];
        const cat = p[2];
        if (cat === "TABLES") {
          const rows = await GetTables(connectionId, schema);
          return (rows ?? []).map((t) => ({
            title: t.name,
            key: joinKey("tbl", schema, t.name),
            isLeaf: false,
          }));
        }
        if (cat === "VIEWS") {
          const names = await GetViews(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("view", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "MATERIALIZED_VIEWS") {
          const names = await GetMaterializedViews(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("mview", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "PROCEDURES") {
          const names = await GetProcedures(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("proc", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "FUNCTIONS") {
          const names = await GetFunctions(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("func", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "PACKAGES") {
          const names = await GetPackages(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("pkg", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "SEQUENCES") {
          const names = await GetSequences(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("seq", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "TRIGGERS_SCHEMA") {
          const names = await GetTriggersForSchema(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("trgSch", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "SYNONYMS") {
          const names = await GetSynonyms(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("syn", schema, n),
            isLeaf: true,
          }));
        }
        if (cat === "TYPES") {
          const names = await GetTypes(connectionId, schema);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("typ", schema, n),
            isLeaf: true,
          }));
        }
      }

      if (kind === "tbl" && p.length === 3) {
        const schema = p[1];
        const table = p[2];
        return TABLE_SUB.map((s) => ({
          title: s.title,
          key: joinKey("sub", schema, table, s.suffix),
          isLeaf: false,
        }));
      }

      if (kind === "sub" && p.length === 4) {
        const schema = p[1];
        const table = p[2];
        const sub = p[3];
        if (sub === "COLUMNS") {
          const cols = await GetColumns(connectionId, schema, table);
          return (cols ?? []).map((c) => ({
            title: `${c.name} (${c.dataType})`,
            key: joinKey("col", schema, table, c.name),
            isLeaf: true,
          }));
        }
        if (sub === "INDEXES") {
          const idx = await GetIndexes(connectionId, schema, table);
          return (idx ?? []).map((i) => ({
            title: `${i.name} (${i.uniqueness})`,
            key: joinKey("idx", schema, table, i.name),
            isLeaf: true,
          }));
        }
        if (sub === "CONSTRAINTS") {
          const cs = await GetConstraints(connectionId, schema, table);
          return (cs ?? []).map((c) => ({
            title: `${c.name} [${c.constraintType}]`,
            key: joinKey("cons", schema, table, c.name),
            isLeaf: true,
          }));
        }
        if (sub === "TRIGGERS_TABLE") {
          const names = await GetTriggersForTable(connectionId, schema, table);
          return (names ?? []).map((n) => ({
            title: n,
            key: joinKey("trgTbl", schema, table, n),
            isLeaf: true,
          }));
        }
      }

      return [];
    },
    [connectionId]
  );

  const onLoadData = async (node: EventDataNode<DataNode>) => {
    const k = String(node.key);
    if (loadingKeys.has(k) || (node.children && node.children.length > 0)) {
      return;
    }
    setLoadingKeys((prev) => new Set(prev).add(k));
    try {
      const children = await loadChildren(k);
      setTreeData((origin) => updateTreeData(origin, node.key, children));
    } finally {
      setLoadingKeys((prev) => {
        const n = new Set(prev);
        n.delete(k);
        return n;
      });
    }
  };

  const titleRender = (node: DataNode) => {
    const key = String(node.key);
    const p = parseKey(key);
    const onDoubleClick = () => {
      if (p[0] === "tbl" && p.length === 3) {
        const schema = p[1];
        const table = p[2];
        appendSqlToActiveTab(`${schema}.${table}`);
      }
    };
    return (
      <span onDoubleClick={onDoubleClick} style={{ cursor: "default" }}>
        {node.title as ReactNode}
      </span>
    );
  };

  if (!connectionId) {
    return (
      <div className="schema-tree-placeholder">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Connect to browse schema
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className="schema-tree">
      <div className="schema-tree-toolbar">
        <Typography.Text strong style={{ fontSize: 12 }}>
          Schema
        </Typography.Text>
        <Button type="link" size="small" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      <Tree
        showLine
        loadData={onLoadData}
        treeData={treeData}
        titleRender={titleRender}
        blockNode
        style={{ fontSize: 12 }}
      />
    </div>
  );
}
